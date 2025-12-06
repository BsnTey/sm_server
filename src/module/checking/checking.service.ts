import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { List, Products } from '../account/interfaces/products.interface';
import { chunk, cmp, requestWithBackoff, startOfNextDayUTC } from './utils/set-products.utils';
import { SetPersonalDiscountAccountRequestDto } from './dto/set-personal-discount.dto';
import { TgPersonalDiscountDto } from './dto/tg-personal-discount.dto';
import { RABBIT_MQ_QUEUES } from '@common/broker/rabbitmq.queues';
import { AccountDiscountsToInsert, NodeAccountDiscount, UpsertNodeDiscountInput } from './interfaces/account-discount.interface';
import { keyNodeInput, keyProductInfo } from './cache-key/key';
import { DelayedPublisher } from '@common/broker/delayed.publisher';
import { RedisCacheService } from '../cache/cache.service';
import { AccountService } from '../account/account.service';
import { UserService } from '../user/user.service';
import { PersonalDiscountChunkWorkerPayload } from './interfaces/queqe.interface';
import { AccountDiscountService } from './account-discount.service';
import { ProductBatchSaver } from './utils/product-batch-saver';
import { PersonalDiscount } from '../account/interfaces/personal-discount.interface';
import { CheckProductBatchRequestDto, PrepareProductCheckRequestDto } from './dto/check-product.prepare.dto';
import { PreparedAccountInfo } from './interfaces/extend-chrome.interface';
import { OrderService } from '../order/order.service';
import { CashedProduct, CheckProductResultItem, ResponseCheckProduct } from './interfaces/my-discount.interface';
import { ProductApiResponse } from '../account/interfaces/product.interface';
import { CalculateService } from '../calculate/calculate.service';

interface AccountProxyItem {
    accountId: string;
    proxyUuid: string;
}

@Injectable()
export class CheckingService {
    private readonly logger = new Logger(CheckingService.name);

    private TTL_NODE_INPUT = 1000;
    private readonly MAX_CONCURRENCY = 5;
    private readonly RABBIT_THREADS = 3;
    private readonly PAGE_SIZE = 100;
    private readonly PERSONAL_DISCOUNT_RATE_SECONDS = 80;

    constructor(
        private accountService: AccountService,
        private accountDiscountService: AccountDiscountService,
        private orderService: OrderService,
        private userService: UserService,
        private calculateService: CalculateService,
        private readonly publisher: DelayedPublisher,
        private readonly cacheService: RedisCacheService,
    ) {}

    //принимает с контроллера входящие аккаунты, сейвит в очередь на нарезку под прокси chunkingAccountForProxy
    async queueAccountsForPersonalDiscountV1(data: SetPersonalDiscountAccountRequestDto): Promise<{
        ok: boolean;
        estimatedSeconds: number;
    }> {
        const user = await this.userService.getUserByTelegramId(data.telegramId);
        if (!user) {
            throw new NotFoundException('Пользователь не найден');
        }

        const normalized = data.personalDiscounts.map(id => id.trim()).filter(Boolean);
        const uniqueAccountIds = Array.from(new Set(normalized));

        if (!uniqueAccountIds.length) {
            throw new HttpException('Не предоставлено валидных аккаунтов', HttpStatus.BAD_REQUEST);
        }

        //делаем обнуление сразу перед новой загрузкой
        await this.accountDiscountService.deleteAllByTelegramId(data.telegramId);

        await this.publisher.publish(
            RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_INPUT_QUEUE,
            {
                telegramId: data.telegramId,
                personalDiscounts: uniqueAccountIds,
            },
            0,
        );

        const estimatedSeconds = Math.ceil(uniqueAccountIds.length / this.MAX_CONCURRENCY) * this.PERSONAL_DISCOUNT_RATE_SECONDS;

        this.logger.log(
            `[queueAccountsForPersonalDiscountV1] Поставлено в очередь ${uniqueAccountIds.length} аккаунтов для персональных скидок (telegramId=${data.telegramId}). Ожидаемое время: ${estimatedSeconds}с`,
        );

        return {
            ok: true,
            estimatedSeconds,
        };
    }

    async updatePersonalDiscountByTelegram(data: TgPersonalDiscountDto) {
        const { telegramId } = data;
        const user = await this.userService.getUserByTelegramId(telegramId);
        if (!user) {
            throw new NotFoundException('Пользователь не найден');
        }

        const accountIds = await this.accountDiscountService.findDistinctAccountIdsByTelegram(telegramId);

        if (!accountIds.length) {
            throw new HttpException('Не найдено аккаунтов для обновления', HttpStatus.BAD_REQUEST);
        }

        return this.queueAccountsForPersonalDiscountV1({
            telegramId,
            personalDiscounts: accountIds,
        });
    }

    //нарезает аккаунты по проксям и шлет в очередь на обработку setAccountsForNodes
    async chunkingAccountForProxy(data: SetPersonalDiscountAccountRequestDto) {
        const { telegramId, personalDiscounts } = data;

        // 1. ЕДИНАЯ ТОЧКА ВХОДА: Получаем уже готовые, нарезанные чанки
        const finalBatches = await this.createDistributionPlan(personalDiscounts, this.RABBIT_THREADS, this.MAX_CONCURRENCY);

        // 2. Отправка (Transport Logic)
        const total = finalBatches.length;
        let count = 0;

        for (const batch of finalBatches) {
            count++;
            const payload: PersonalDiscountChunkWorkerPayload = {
                telegramId,
                accounts: batch,
                count,
                total,
            };
            await this.publisher.publish(RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_CHUNK_QUEUE, payload, 0);
            this.logger.log(`[Chunking] Отправлен чанк ${count}/${total} для telegramId=${telegramId} (аккаунтов: ${batch.length})`);
        }
    }

    /**
     * ОРКЕСТРАТОР: Фасад для подготовки данных.
     * Принимает сырые ID, возвращает готовую матрицу распределения.
     */
    private async createDistributionPlan(accountIds: string[], threads: number, chunkSize: number): Promise<string[][]> {
        // Шаг А: Обогащение данных (I/O операция)
        const accountProxies = await this.resolveProxiesForAccounts(accountIds);

        // Шаг Б: Алгоритмическое распределение (CPU операция)
        return this.distributeAccountsToChunks(
            accountProxies,
            threads, // Шаг "прыжка" (кол-во потоков)
            chunkSize,
        );
    }

    /**
     * Helper 1: Получение UUID проксей (I/O Bound)
     */
    private async resolveProxiesForAccounts(accountIds: string[]): Promise<AccountProxyItem[]> {
        const results: AccountProxyItem[] = [];

        // Разбиваем на батчи, чтобы не перегрузить accountService
        for (const partAcc of chunk(accountIds, this.MAX_CONCURRENCY)) {
            const settled = await Promise.allSettled(
                partAcc.map(async accountId => {
                    const proxyUuid = await this.accountService.getProxyUuid(accountId);
                    return { accountId, proxyUuid };
                }),
            );

            settled.forEach(r => {
                // Собираем только успешные результаты, у которых есть proxyUuid
                if (r.status === 'fulfilled' && r.value.proxyUuid) {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    //@ts-expect-error
                    results.push(r.value);
                }
            });
        }

        return results;
    }

    /**
     * Helper 2: Алгоритм "Skip-Ahead" (CPU Bound / Pure Function)
     * Не делает запросов, только математика массивов.
     */
    private distributeAccountsToChunks(items: AccountProxyItem[], threads: number, chunkSize: number): string[][] {
        // 1. Группировка
        const groupedByProxy = new Map<string, string[]>();
        for (const item of items) {
            if (!groupedByProxy.has(item.proxyUuid)) {
                groupedByProxy.set(item.proxyUuid, []);
            }
            groupedByProxy.get(item.proxyUuid)!.push(item.accountId);
        }

        // 2. Сортировка (от самых "жирных" групп к мелким)
        const sortedProxyGroups = Array.from(groupedByProxy.values()).sort((a, b) => b.length - a.length);

        // 3. Распределение
        const allChunks: string[][] = [];

        for (const accounts of sortedProxyGroups) {
            // Инициализируем индекс так, чтобы первый (idx + threads) мог быть 0
            let lastPlacedIndex = -1 * threads;

            for (const accountId of accounts) {
                let searchStartIndex = lastPlacedIndex + threads;
                if (searchStartIndex < 0) searchStartIndex = 0;

                let placed = false;
                let currentIndex = searchStartIndex;

                while (!placed) {
                    if (!allChunks[currentIndex]) {
                        allChunks[currentIndex] = [];
                    }

                    if (allChunks[currentIndex].length < chunkSize) {
                        allChunks[currentIndex].push(accountId);
                        lastPlacedIndex = currentIndex;
                        placed = true;
                    } else {
                        // Если слот занят, идем в следующий (увеличиваем дистанцию)
                        currentIndex++;
                    }
                }
            }
        }

        // 4. Удаление пустых слотов (если массив получился разреженным)
        return allChunks.filter(b => b && b.length > 0);
    }

    /**
     * Воркер обновления AccountDiscount для чанков из очереди.
     * Оркестратор процесса.
     */
    async setAccountsForNodes(chunkData: PersonalDiscountChunkWorkerPayload) {
        const { telegramId, accounts: accountIds, count, total } = chunkData;
        this.logger.log(
            `[NodesWorker] Начало обработки чанка на проверку категорий ${count}/${total} для telegramId=${telegramId} (аккаунтов: ${accountIds.length})`,
        );

        // 1. Получение данных (Parallel API calls)
        const responses = await this.fetchPersonalDiscounts(accountIds);

        // 2. Обработка результатов (Data Transformation & Error Handling)
        const data = this.processDiscountResults(telegramId, accountIds, responses);

        // 3. Сохранение Нод (Cache-First Strategy)
        // Сохраняем только те ноды, которых еще нет в кеше/БД
        await this.saveNewNodesIfNotExist(data.uniqueNodes);

        // 4. Перезапись связей (AccountDiscount)
        await this.accountDiscountService.createAccountDiscountsBatch(data.relationsToInsert);

        // 5. Отправка в следующую очередь (только те, у кого есть скидки)
        if (data.accountsWithDiscounts.length > 0) {
            await this.publishToProductQueue(telegramId, data.accountsWithDiscounts, count, total);
            this.logger.log(
                `[NodesWorker] Чанк ${count}/${total} обработан. Аккаунтов со скидками: ${data.accountsWithDiscounts.length}. Отправлено в очередь продуктов.`,
            );
        } else {
            this.logger.log(`[NodesWorker] Чанк ${count}/${total} обработан. Скидок не найдено. В очередь продуктов не отправляем.`);
        }

        if (count === total) {
            await this.publisher.publish(
                RABBIT_MQ_QUEUES.MESSAGES_TO_TELEGRAM_QUEUE,
                {
                    telegramId: +telegramId,
                    message: `✅ Обновление персональных скидок для режима категорий завершено!`,
                },
                0,
            );
        }
    }

    /**
     * Шаг 1: Загрузка данных из внешнего сервиса
     */
    private async fetchPersonalDiscounts(accountIds: string[]) {
        return Promise.allSettled(accountIds.map(accId => this.accountService.personalDiscount(accId)));
    }

    /**
     * Шаг 2: Разбор ответов, обработка ошибок и подготовка структур данных
     */
    private processDiscountResults(telegramId: string | number, accountIds: string[], responses: PromiseSettledResult<PersonalDiscount>[]) {
        // Результаты
        const accountsWithDiscounts: string[] = [];
        const uniqueNodes = new Map<string, UpsertNodeDiscountInput>();
        const relationsToInsert: AccountDiscountsToInsert[] = [];

        responses.forEach((res, index) => {
            const accountId = accountIds[index];

            // А. Обработка ошибки запроса
            if (res.status === 'rejected') {
                this.logger.error(`Ошибка получения скидок для ${accountId}`, res.reason?.message);
                this.publisher.publish(
                    RABBIT_MQ_QUEUES.MESSAGES_TO_TELEGRAM_QUEUE,
                    {
                        telegramId: +telegramId,
                        message: `❗️ Ошибка получения скидок для аккаунта ${accountId}: ${res.reason?.message}`,
                    },
                    0,
                );
                return;
            }

            const pd = res.value;

            if (!pd?.list?.length) return;

            // В. Если скидки есть - готовим к следующему этапу
            accountsWithDiscounts.push(accountId);

            // Г. Сбор данных для вставки
            pd.list.forEach(n => {
                const nodeId = n.base.nodeId;

                // Справочник нод (дедупликация)
                if (!uniqueNodes.has(nodeId)) {
                    uniqueNodes.set(nodeId, {
                        nodeId: nodeId,
                        nodeName: n.nodeName,
                        url: n.url,
                        dateEnd: startOfNextDayUTC(n.dateEnd),
                    });
                }

                // Связь Аккаунт-Нода
                relationsToInsert.push({
                    accountId,
                    telegramId: String(telegramId),
                    nodeId,
                });
            });
        });

        return { accountsWithDiscounts, uniqueNodes, relationsToInsert };
    }

    /**
     * Шаг 3: Умное сохранение нод. Проверяет кеш, чтобы не долбить БД лишний раз.
     */
    private async saveNewNodesIfNotExist(nodesMap: Map<string, UpsertNodeDiscountInput>) {
        if (nodesMap.size === 0) return;

        const nodesToWrite: UpsertNodeDiscountInput[] = [];
        const nodes = Array.from(nodesMap.values());

        // Параллельная проверка кеша
        await Promise.all(
            nodes.map(async node => {
                const key = keyNodeInput(node.nodeId);
                const cached = await this.cacheService.get(key);

                if (!cached) {
                    nodesToWrite.push(node);
                    // Сразу греем кеш, не дожидаясь записи в БД, чтобы соседние потоки уже видели эту ноду
                    await this.cacheService.set(key, node, this.TTL_NODE_INPUT);
                }
            }),
        );

        if (nodesToWrite.length > 0) {
            await this.accountDiscountService.ensureNodesExist(nodesToWrite);
        }
    }

    /**
     * Шаг 5: Публикация в RabbitMQ
     */
    private async publishToProductQueue(telegramId: string, accounts: string[], count: number, total: number) {
        const nextPayload: PersonalDiscountChunkWorkerPayload = {
            telegramId,
            accounts,
            count,
            total,
        };
        await this.publisher.publish(RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_PRODUCT_QUEUE, nextPayload, 0);
    }

    //воркер обновления AccountDiscountProduct для чанков из очереди
    async setAccountsDiscountProduct(chunkData: PersonalDiscountChunkWorkerPayload) {
        const { telegramId, accounts: accountIds, count, total } = chunkData;
        this.logger.log(
            `[ProductsWorker] Начало обработки чанка ${count}/${total} для telegramId=${telegramId} (аккаунтов: ${accountIds.length})`,
        );
        const results: Array<{ accountId: string; saved: number }> = [];
        const errors: Array<{ accountId: string; message: string }> = [];

        // 1. Подготовка данных (I/O)
        // Получаем ноды для всех аккаунтов сразу (оптимизация)
        const nodesByAccount = await this.accountDiscountService.getNodesForAccounts(String(telegramId), accountIds);

        // 2. Инициализация менеджера батчей
        const batchSaver = new ProductBatchSaver(this.accountDiscountService, this.logger);

        // 3. Обработка аккаунтов чанками (Concurrency Control)
        for (const part of chunk(accountIds, this.MAX_CONCURRENCY)) {
            const settled = await Promise.allSettled(
                part.map(accountId =>
                    this.processSingleAccount(accountId, String(telegramId), nodesByAccount.get(accountId) || [], batchSaver),
                ),
            );

            // Обработка результатов промисов
            settled.forEach((r, idx) => {
                const accId = part[idx];
                if (r.status === 'fulfilled') {
                    results.push(r.value);
                } else {
                    errors.push({ accountId: accId, message: r.reason?.message || 'Unknown' });
                    this.logger.error(`Ошибка обработки аккаунта ${accId}`, r.reason);
                }
            });

            // Сбрасываем буфер после каждой пачки аккаунтов
            await batchSaver.flush();
        }

        // 4. Финальный сброс (на всякий случай)
        await batchSaver.flush();

        // 5. Логирование и итоги
        this.logProcessingResults(telegramId, results, errors);

        if (count == total) {
            await this.publisher.publish(
                RABBIT_MQ_QUEUES.MESSAGES_TO_TELEGRAM_QUEUE,
                {
                    telegramId: +telegramId,
                    message: `✅ Обновление персональных скидок для быстрого режима завершено!`,
                },
                0,
            );
        }
    }

    /**
     * Обрабатывает один аккаунт: проходит по всем его нодам.
     */
    private async processSingleAccount(accountId: string, telegramId: string, nodes: NodeAccountDiscount[], batchSaver: ProductBatchSaver) {
        let totalSaved = 0;

        for (const node of nodes) {
            try {
                const count = await this.fetchAndBufferProducts(accountId, telegramId, node, batchSaver);
                totalSaved += count;
            } catch (e) {
                this.logger.error(`Не удалось обработать ноду ${node.url} для аккаунта ${accountId}`, e);
                // Не прерываем весь аккаунт из-за одной ноды
            }
        }

        return { accountId, saved: totalSaved };
    }

    /**
     * Работает с API: пагинация, маппинг данных и отправка в буфер.
     */
    private async fetchAndBufferProducts(
        accountId: string,
        telegramId: string,
        node: NodeAccountDiscount,
        batchSaver: ProductBatchSaver,
    ): Promise<number> {
        let savedCount = 0;

        // Генератор пагинации
        const productStream = this.paginateProducts(
            accountId,
            node.url,
            this.PAGE_SIZE,
            20, // Max pages cap
            this.accountService.findProductsBySearch.bind(this.accountService),
        );

        for await (const page of productStream) {
            for (const item of page) {
                const productId = String(item.id);

                const needFlushDiscount = batchSaver.addDiscount({
                    productId,
                    telegramId,
                    accountId,
                    nodeId: node.nodeId,
                });

                if (needFlushDiscount) await batchSaver.flush();
                savedCount++;

                if (Array.isArray(item.skus) && item.skus.length) {
                    for (const skuItem of item.skus) {
                        const needFlushInfo = batchSaver.addInfo(productId, skuItem.code, skuItem.id);
                        if (needFlushInfo) await batchSaver.flush();
                    }
                } else if (item.code) {
                    const needFlushInfo = batchSaver.addInfo(productId, item.code, null);
                    if (needFlushInfo) await batchSaver.flush();
                }
            }
        }

        return savedCount;
    }

    async *paginateProducts(
        accountId: string,
        nodeUrl: string,
        pageSize = 100,
        maxPagesCap = 20,
        findProductsBySearch: (accountId: string, url: string, limit: number, offset: number) => Promise<Products>,
    ) {
        let offset = 0;
        let total: number | null = null;
        let pages = 0;

        while (pages < maxPagesCap) {
            const res = await requestWithBackoff(() => findProductsBySearch(accountId, nodeUrl, pageSize, offset));
            const items: List[] = res.list ?? [];
            pages++;

            // Если total ещё неизвестен и meta пришла — зафиксируем total один раз
            if (total === null && res.meta?.count != null) {
                total = res.meta.count;
                if (total <= 0) break;
            }

            // Пустая страница — стоп
            if (items.length === 0) break;

            // Отдаём текущие элементы
            yield items;

            // Если знаем общий total — контролируем окончание по нему
            if (total !== null) {
                offset += pageSize;
                if (offset >= total) break; // всё прочитали
            } else {
                // total неизвестен: ориентируемся по «неполной» странице
                if (items.length < pageSize) break; // последняя страница
                offset += pageSize;
            }
        }
    }

    private logProcessingResults(telegramId: number | string, results: any[], errors: any[]) {
        const totalSaved = results.reduce((acc, val) => acc + val.saved, 0);
        this.logger.log(
            `[ProductsWorker] Итоги: User ${telegramId} | Аккаунтов: ${results.length} | Сохранено товаров: ${totalSaved} | Ошибок: ${errors.length}`,
        );

        if (errors.length > 0) {
            if (errors.length > 0) {
                this.publisher.publish(
                    RABBIT_MQ_QUEUES.MESSAGES_TO_TELEGRAM_QUEUE,
                    {
                        telegramId: +telegramId,
                        message: `⚠️ Ошибки при загрузке товаров (${errors.length} акк).`,
                    },
                    0,
                );
            }
        }
    }

    async prepareAccountsForProductCheckV1({ telegramId, nodeId }: PrepareProductCheckRequestDto): Promise<{
        accounts: PreparedAccountInfo[];
        chunkSize: number;
    }> {
        const user = await this.userService.getUserByTelegramId(telegramId);
        if (!user) {
            throw new NotFoundException('Пользователь не найден');
        }

        // 1. аккаунты по телеграму и ноде
        const accountIds = await this.accountDiscountService.findAccountIdsByTelegramAndNodes(telegramId, nodeId);

        if (!accountIds?.length) {
            return { accounts: [], chunkSize: this.MAX_CONCURRENCY };
        }

        // 2. заказы за сегодня (map accountId -> count)
        const ordersTodayMap = await this.orderService.countTodayByAccountIds(accountIds);

        // 3. бонусы (map accountId -> bonusCount)
        const bonusMap = await this.accountService.getBonusCountByAccountIds(accountIds);

        // 4. собрать итоговый список
        const accounts: PreparedAccountInfo[] = accountIds.map(accountId => ({
            accountId,
            bonus: bonusMap[accountId] ?? 0,
            ordersNumber: ordersTodayMap[accountId] ?? 0,
        }));

        accounts.sort(cmp);

        return {
            accounts,
            chunkSize: this.MAX_CONCURRENCY,
        };
    }

    async getAccountsForPersonalDiscountV3(telegramId: string, productId: string): Promise<{ data: ResponseCheckProduct }> {
        const accountIds = await this.accountDiscountService.findAccountsForProduct(telegramId, productId);

        const errors = new Map<string, string>();

        // --- Предзагрузка бонусов и заказов ---
        const [ordersTodayMap, bonusMap] = await Promise.all([
            this.orderService.countTodayByAccountIds(accountIds),
            this.accountService.getBonusCountByAccountIds(accountIds),
        ]);

        const accounts: PreparedAccountInfo[] = accountIds.map(accountId => ({
            accountId,
            bonus: bonusMap[accountId] ?? 0,
            ordersNumber: ordersTodayMap[accountId] ?? 0,
        }));

        accounts.sort(cmp);

        const MAX_ROUNDS = 3;

        // --- Обновляем bonus у топ-3 для повышения точности сортировки ---
        for (let round = 1; round <= MAX_ROUNDS; round++) {
            const topN = Math.min(3, accounts.length);
            if (topN === 0) break;

            const topSlice = accounts.slice(0, topN);
            const checks = await Promise.allSettled(topSlice.map(a => this.accountService.shortInfoWithCache(a.accountId)));

            let mismatches = 0;

            checks.forEach((res, idx) => {
                const acc = topSlice[idx];
                if (res.status === 'fulfilled') {
                    const freshBonus = Number(res.value?.bonusCount ?? 0);

                    if (Number.isFinite(freshBonus)) {
                        if (freshBonus !== acc.bonus) mismatches++;

                        const target = accounts.find(x => x.accountId === acc.accountId);
                        if (target) {
                            target.bonus = freshBonus;
                        }
                    }
                } else {
                    const msg = res.reason?.response?.data?.message ?? res.reason?.message ?? 'Ошибка получения количества бонусов';
                    errors.set(acc.accountId, msg);
                }
            });

            if (mismatches >= 2 && round < MAX_ROUNDS) {
                accounts.sort(cmp);
                continue;
            }

            break;
        }

        let cachedProduct = await this.getFromCacheProduct(productId);

        if (!cachedProduct) {
            const attempts = Math.min(accounts.length, 3);

            for (let i = 0; i < attempts; i++) {
                try {
                    const result = await this.accountService.getProductById(accounts[i].accountId, productId);

                    if (result?.product) {
                        cachedProduct = await this.cashedAndGetProductInfo(result.product);
                    }

                    if (cachedProduct) {
                        break;
                    }
                } catch (error) {
                    this.logger.warn(`Attempt ${i + 1} failed for account ${accounts[i].accountId}`);
                }
            }
        }

        let calcProd = null;
        if (cachedProduct) {
            calcProd = cachedProduct.calc;
        }

        accounts.sort(cmp);

        const results: CheckProductResultItem[] = accounts.map(acc => {
            const errorMsg = errors.get(acc.accountId);
            if (errorMsg) {
                return { accountId: acc.accountId, error: errorMsg };
            }

            const requiredBonus = calcProd?.calcBonusForProduct ?? 0;
            const basePrice = calcProd?.calcPriceForProduct ?? 0;

            const countDelta = requiredBonus - acc.bonus;

            let avaliablePriceOnKassa = basePrice;

            if (countDelta > 0) {
                avaliablePriceOnKassa += countDelta;
            }

            return {
                accountId: acc.accountId,
                info: {
                    bonusesOnAccount: acc.bonus,
                    ordersToday: acc.ordersNumber,
                    product: {
                        avaliableBonusForProduct: Math.min(requiredBonus, acc.bonus),
                        avaliablePriceOnKassa: avaliablePriceOnKassa,
                    },
                },
            };
        });

        return {
            data: {
                accountIds: results,
                calcProd,
            },
        };
    }

    async checkProductBatchForPersonalDiscount({ telegramId, productId, accountIds }: CheckProductBatchRequestDto): Promise<{
        data: ResponseCheckProduct;
    }> {
        const user = await this.userService.getUserByTelegramId(telegramId);
        if (!user) {
            throw new NotFoundException('Пользователь не найден');
        }

        const ordersTodayMap = await this.orderService.countTodayByAccountIds(accountIds);
        const results: CheckProductResultItem[] = [];

        const [probeId, ...restIds] = accountIds;

        try {
            const result = await this.processSingleAccountForNode(probeId, productId, ordersTodayMap[probeId] || 0);
            if (result) results.push(result);
        } catch (e: any) {
            if (this.isNotFound404(e)) {
                throw new NotFoundException('Не найден продукт');
            }
            const errorText = this.extractErrorMessage(e);
            results.push({ accountId: probeId, error: errorText });
        }

        const worker = async (accountId: string): Promise<void> => {
            try {
                const result = await this.processSingleAccountForNode(accountId, productId, ordersTodayMap[accountId] || 0);
                if (result) results.push(result);
            } catch (err: any) {
                const errorText = this.extractErrorMessage(err);
                results.push({ accountId, error: errorText });
            }
        };

        for (let i = 0; i < restIds.length; i += this.MAX_CONCURRENCY) {
            const slice = restIds.slice(i, i + this.MAX_CONCURRENCY);
            await Promise.all(slice.map(id => worker(id)));
        }

        let calcProd = null;
        if (accountIds.length > 0) {
            const calcProdFromCache = await this.getFromCacheProduct(productId);
            if (calcProdFromCache) {
                calcProd = calcProdFromCache.calc;
            }
        }

        return {
            data: {
                accountIds: results,
                calcProd,
            },
        };
    }

    /**
     * Единая логика обработки одного аккаунта.
     * Запрашивает продукт и баланс бонусов параллельно для ускорения.
     */
    private async processSingleAccountForNode(
        accountId: string,
        productId: string,
        ordersToday: number,
    ): Promise<CheckProductResultItem | null> {
        const productRes = await this.accountService.getProductById(accountId, productId);
        const product = productRes?.product;

        if (!product?.id) {
            throw new Error('Нет информации о продукте или не верный productId');
        }

        if (!this.hasMyDiscountInDiscountList(product)) {
            return null;
        }

        this.cashedAndGetProductInfo(product);

        let bonusCount = 0;
        try {
            const short = await this.accountService.shortInfoWithCache(accountId);
            bonusCount = short.bonusCount || 0;
        } catch (e) {}

        return this.buildResult(product, accountId, bonusCount, ordersToday);
    }

    private extractErrorMessage(err: any): string {
        if (this.isBadRequest400(err)) {
            return err?.response?.data?.message ?? 'Ошибка аккаунта (400)';
        }
        return err?.response?.data?.message ?? err?.message ?? 'UNKNOWN_ERROR';
    }

    private getHttpStatus(err: any): number | undefined {
        return err?.response?.status ?? err?.response?.data?.statusCode;
    }

    private isBadRequest400(err: any): boolean {
        return this.getHttpStatus(err) === 400;
    }

    private isNotFound404(err: any): boolean {
        const status = this.getHttpStatus(err);
        const msg = err?.response?.data?.message ?? err?.message;
        return status === 404 || msg === 'PRODUCT_NOT_FOUND';
    }

    private hasMyDiscountInDiscountList(p: ProductApiResponse['product']): boolean {
        const list = p?.personalPrice?.discountList ?? [];
        return list.some(x => x?.actionName?.toLowerCase() === 'моя скидка');
    }

    private mapBonuses(p: ProductApiResponse['product']): number {
        const list = p?.personalPrice?.discountList ?? [];
        const item = list.find(x => x?.actionName?.toLowerCase() === 'оплата бонусами');
        const raw = item?.summa?.value;
        return raw ? Number(raw) / 100 : 0;
    }

    async findProductsByQueries(queries: string[]) {
        const results = await Promise.all(queries.map(q => this.accountDiscountService.findProductsByVariant(q)));
        // Flatten and deduplicate by productId
        const allProducts = results.flat();
        const uniqueProducts = new Map();
        for (const p of allProducts) {
            if (!uniqueProducts.has(p.productId)) {
                uniqueProducts.set(p.productId, p);
            }
        }
        return Array.from(uniqueProducts.values());
    }

    async findAccountsForProductsIntersection(
        telegramId: string,
        productIds: string[],
    ): Promise<{
        accounts: PreparedAccountInfo[];
        productIds: string[];
    }> {
        if (!productIds.length) {
            return { accounts: [], productIds: [] };
        }

        // 1. Get accounts for each product
        const accountsPerProduct = await Promise.all(
            productIds.map(pid => this.accountDiscountService.findAccountsForProduct(telegramId, pid)),
        );

        // 2. Find intersection
        // Start with the first list
        let intersection = new Set(accountsPerProduct[0]);

        for (let i = 1; i < accountsPerProduct.length; i++) {
            const currentSet = new Set(accountsPerProduct[i]);
            intersection = new Set([...intersection].filter(x => currentSet.has(x)));
        }

        const intersectionArray = Array.from(intersection);

        if (!intersectionArray.length) {
            return { accounts: [], productIds };
        }

        // 3. Enrich with bonuses and orders
        const [ordersTodayMap, bonusMap] = await Promise.all([
            this.orderService.countTodayByAccountIds(intersectionArray),
            this.accountService.getBonusCountByAccountIds(intersectionArray),
        ]);

        const accounts: PreparedAccountInfo[] = intersectionArray.map(accountId => ({
            accountId,
            bonus: bonusMap[accountId] ?? 0,
            ordersNumber: ordersTodayMap[accountId] ?? 0,
        }));

        accounts.sort(cmp);

        return { accounts, productIds };
    }

    private mapProduct(p: ProductApiResponse['product']) {
        const rawPrice = p?.personalPrice?.price?.value;
        const avaliablePriceOnKassa = rawPrice ? Number(rawPrice) / 100 : 0;

        return {
            avaliablePriceOnKassa,
            avaliableBonusForProduct: this.mapBonuses(p),
        };
    }

    private getFromCacheProduct(productId: string): Promise<CashedProduct | null> {
        const key = keyProductInfo(productId);
        return this.cacheService.get<CashedProduct>(key);
    }

    private async setToCacheProduct(product: ProductApiResponse['product']): Promise<CashedProduct> {
        const key = keyProductInfo(product.id);
        const percentMyDiscount = this.calculateService.calcPercentMyDiscount(product);

        const priceCatalog = +product.price.catalog.value / 100;
        const priceRetail = +product.price.retail.value / 100;

        const calc = this.calculateService.computeCalculateFromProduct(product, percentMyDiscount, Boolean(percentMyDiscount));

        const cashedProduct = {
            priceCatalog,
            priceRetail,
            calc,
            percentMyDiscount,
        };

        this.cacheService.setUntilEndOfDay(key, cashedProduct);

        return cashedProduct;
    }

    private async cashedAndGetProductInfo(product: ProductApiResponse['product']): Promise<CashedProduct> {
        const cached = await this.getFromCacheProduct(product.id);
        if (!cached) {
            return this.setToCacheProduct(product);
        }
        return cached;
    }

    private buildResult(
        p: ProductApiResponse['product'],
        accountId: string,
        bonuses: number,
        ordersToday: number = 0,
    ): CheckProductResultItem {
        const product = this.mapProduct(p);
        const info = {
            bonusesOnAccount: bonuses,
            ordersToday,
            product,
        };

        return {
            accountId,
            info,
        };
    }
}
