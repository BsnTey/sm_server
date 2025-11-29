import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { List, Products } from '../account/interfaces/products.interface';
import { chunk, cmp, requestWithBackoff, startOfNextDayUTC } from './utils/set-products.utils';
import { SetPersonalDiscountAccountRequestDto } from './dto/set-personal-discount.dto';
import { RABBIT_MQ_QUEUES } from '@common/broker/rabbitmq.queues';
import {
    AccountDiscountsToInsert,
    CreatePersonalDiscountProductsInput,
    NodeAccountDiscount,
    NodeForAccount,
    NodePair,
    UpsertNodeDiscountInput,
} from './interfaces/account-discount.interface';
import { keyDiscountAccount, keyDiscountNodes, keyNodeInput } from './cache-key/key';
import { AccountTelegramParamsDto } from '../account/dto/account-telegram-ids.dto';
import { ProductApiResponse } from '../account/interfaces/product.interface';
import { CheckProductBatchRequestDto, PrepareProductCheckRequestDto } from './dto/check-product.prepare.dto';
import { PreparedAccountInfo } from './interfaces/extend-chrome.interface';
import { ErrorItem, PersonalDiscount } from '../account/interfaces/personal-discount.interface';
import { extractPercentFromNode } from '../account/utils/extract.utils';
import { ConfigService } from '@nestjs/config';
import { AccountDiscountRepository } from './account-discount.repository';
import { OrderRepository } from '../account/order.repository';
import { ProxyService } from '../proxy/proxy.service';
import { CalculateService } from '../calculate/calculate.service';
import { DelayedPublisher } from '@common/broker/delayed.publisher';
import { CacheService } from '../cache/cache.service';
import { AccountService } from '../account/account.service';
import { parseDateFlexible } from '../account/utils/parse-data';
import { UserService } from '../user/user.service';
import { AccountWithProxyEntity } from '../account/entities/accountWithProxy.entity';
import { PersonalDiscountChunkWorkerPayload } from './interfaces/queqe.interface';
import { AccountDiscountService } from './account-discount.service';
import { TelegramService } from '../telegram/telegram.service';
import { ProductBatchSaver } from './utils/product-batch-saver';

interface AccountProxyItem {
    accountId: string;
    proxyUuid: string;
}

@Injectable()
export class CheckingService {
    private readonly logger = new Logger(CheckingService.name);
    private TTL_CASH_DISCOUNT = 10_800_000;
    private TTL_NODE_INPUT = 80_000_000;
    private readonly MAX_CONCURRENCY = 5;
    private readonly RABBIT_THREADS = 3; // Количество параллельных потоков RabbitMQ
    private readonly PRODUCT_WRITE_CONCURRENCY = 5;
    private readonly PAGE_SIZE = 100;
    private readonly DB_CHUNK = 200;
    private readonly PERSONAL_DISCOUNT_BATCH_SIZE = 5;
    private readonly PERSONAL_DISCOUNT_RATE_SECONDS = 80;

    constructor(
        private accountService: AccountService,
        private telegramService: TelegramService,
        private orderRepository: OrderRepository,
        private calculateService: CalculateService,
        private accountDiscountService: AccountDiscountService,
        private userService: UserService,
        private readonly publisher: DelayedPublisher,
        private readonly cacheService: CacheService,
    ) {}

    //принимает с контроллера входящие аккаунты, сейвит в очередь на нарезку под прокси chunkingAccountForProxy
    async queueAccountsForPersonalDiscountV1(data: SetPersonalDiscountAccountRequestDto): Promise<{
        ok: boolean;
        estimatedSeconds: number;
    }> {
        const user = await this.userService.getUserByTelegramId(data.telegramId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const normalized = data.personalDiscounts.map(id => id.trim()).filter(Boolean);
        const uniqueAccountIds = Array.from(new Set(normalized));

        if (!uniqueAccountIds.length) {
            throw new HttpException('No valid accounts provided', HttpStatus.BAD_REQUEST);
        }

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
            `Queued ${uniqueAccountIds.length} accounts for personal discount V1 (telegramId=${data.telegramId}, batches=${uniqueAccountIds.length})`,
        );

        return {
            ok: true,
            estimatedSeconds,
        };
    }

    //нарезает аккаунты по проксям и шлет в очередь на обработку setAccountsForNodes
    async chunkingAccountForProxy(data: SetPersonalDiscountAccountRequestDto) {
        const { telegramId, personalDiscounts } = data;

        // 1. ЕДИНАЯ ТОЧКА ВХОДА: Получаем уже готовые, нарезанные чанки
        const finalBatches = await this.createDistributionPlan(personalDiscounts);

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
        }
    }

    /**
     * ОРКЕСТРАТОР: Фасад для подготовки данных.
     * Принимает сырые ID, возвращает готовую матрицу распределения.
     */
    private async createDistributionPlan(accountIds: string[]): Promise<string[][]> {
        // Шаг А: Обогащение данных (I/O операция)
        const accountProxies = await this.resolveProxiesForAccounts(accountIds);

        // Шаг Б: Алгоритмическое распределение (CPU операция)
        return this.distributeAccountsToChunks(
            accountProxies,
            this.RABBIT_THREADS, // Шаг "прыжка" (кол-во потоков)
            this.MAX_CONCURRENCY, // Размер чанка
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
                    //@ts-ignore
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

        // 1. Получение данных (Parallel API calls)
        const responses = await this.fetchPersonalDiscounts(accountIds);

        // 2. Обработка результатов (Data Transformation & Error Handling)
        const data = this.processDiscountResults(telegramId, accountIds, responses);

        // 3. Сохранение Нод (Cache-First Strategy)
        // Сохраняем только те ноды, которых еще нет в кеше/БД
        await this.saveNewNodesIfNotExist(data.uniqueNodes);

        // 4. Перезапись связей (AccountDiscount)
        // Обновляем БД для всех успешных аккаунтов (даже если у них пустой список скидок, надо стереть старые)
        if (data.successfulAccountIds.length > 0) {
            await this.accountDiscountService.refreshAccountDiscountsBatch(data.successfulAccountIds, data.relationsToInsert);
        }

        // 5. Отправка в следующую очередь (только те, у кого есть скидки)
        if (data.accountsWithDiscounts.length > 0) {
            await this.publishToProductQueue(telegramId, data.accountsWithDiscounts, count, total);
        }

        // 6. Завершение (Cleanup & Notification)
        await this.cleanupAndNotify(telegramId, count, total);
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
        const successfulAccountIds: string[] = [];
        const accountsWithDiscounts: string[] = [];
        const uniqueNodes = new Map<string, UpsertNodeDiscountInput>();
        const relationsToInsert: AccountDiscountsToInsert[] = [];

        responses.forEach((res, index) => {
            const accountId = accountIds[index];

            // А. Обработка ошибки запроса
            if (res.status === 'rejected') {
                this.handleAccountError(telegramId, accountId, res.reason);
                return;
            }

            const pd = res.value;
            successfulAccountIds.push(accountId);

            // Б. Если скидок нет - просто пропускаем (аккаунт уже в successful для очистки БД)
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

        return { successfulAccountIds, accountsWithDiscounts, uniqueNodes, relationsToInsert };
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

    /**
     * Шаг 6: Очистка кешей и уведомление пользователя
     */
    private async cleanupAndNotify(telegramId: string, count: number, total: number) {
        // Чистим общие кеши пользователя
        const keyNodes = keyDiscountNodes(telegramId);
        const keyAccounts = keyDiscountAccount(telegramId);

        await Promise.all([this.cacheService.del(keyNodes), this.cacheService.del(keyAccounts)]);

        // Если это последний чанк - шлем уведомление
        if (count === total) {
            this.telegramService.sendMessage(+telegramId, `✅ Обновление персональных скидок для режима категорий завершено!`);
        }
    }

    /**
     * Вспомогательная: Логирование ошибок одного аккаунта
     */
    private handleAccountError(telegramId: string | number, accountId: string, reason: any) {
        this.logger.error(`Ошибка получения скидок для ${accountId}`, reason);
        this.telegramService.sendMessage(+telegramId, `❗️ Ошибка получения скидок для аккаунта ${accountId}: ${reason?.message || reason}`);
    }

    //воркер обновления AccountDiscountProduct для чанков из очереди
    async setAccountsDiscountProduct(chunkData: PersonalDiscountChunkWorkerPayload) {
        const { telegramId, accounts: accountIds, count, total } = chunkData;
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
                    this.logger.error(`Error processing account ${accId}`, r.reason);
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
            this.telegramService.sendMessage(+telegramId, `✅ Обновление персональных скидок для быстрого режима завершено!`);
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
                this.logger.error(`Failed to process node ${node.url} for account ${accountId}`, e);
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
            this.accountService.findProductsBySearch.bind(this),
        );

        for await (const page of productStream) {
            for (const item of page) {
                const productId = String(item.id);

                // 1. Регистрируем Скидку (Связь Аккаунт -> Товар -> Нода)
                // dateEnd убрал, так как его нет в интерфейсе CreatePersonalDiscountProductsInput
                // и в модели Prisma account_discount_product (он есть в NodeDiscount)
                const needFlushDiscount = batchSaver.addDiscount({
                    productId,
                    telegramId,
                    accountId,
                    nodeId: node.nodeId,
                });

                if (needFlushDiscount) await batchSaver.flush();
                savedCount++;

                // 2. Регистрируем Справочник (ProductInfo: SKU / Article)
                if (Array.isArray(item.skus) && item.skus.length) {
                    for (const skuItem of item.skus) {
                        const needFlushInfo = batchSaver.addInfo(productId, skuItem.code, skuItem.id);
                        if (needFlushInfo) await batchSaver.flush();
                    }
                } else if (item.code) {
                    // Если SKU нет, но есть артикул у самого товара
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
        this.logger.log(`Discount Products: User ${telegramId} | Accs: ${results.length} | Saved: ${totalSaved} | Errs: ${errors.length}`);

        if (errors.length > 0) {
            this.telegramService.sendMessage(+telegramId, `⚠️ Ошибки при загрузке товаров (${errors.length} акк).`);
        }
    }

    //
    // async getDistinctNodePairsByTelegram(telegramId: string): Promise<{ nodes: NodePair[] }> {
    //     const key = keyDiscountNodes(telegramId);
    //
    //     const nodesCache = await this.cacheManager.get<NodePair[]>(key);
    //
    //     if (nodesCache) return { nodes: nodesCache };
    //
    //     const nodes = await this.accountDiscountRepo.findDistinctNodePairsByTelegram(telegramId);
    //
    //     await this.cacheManager.set(key, nodes, this.TTL_CASH_DISCOUNT);
    //
    //     return { nodes };
    // }
    //
    // async removeDiscountsByAccountIdV1({ telegramId, accountId }: AccountTelegramParamsDto): Promise<{
    //     deleted: number;
    // }> {
    //     const countDelete = await this.accountDiscountRepo.deleteDataForAccount(accountId, telegramId);
    //
    //     return { deleted: countDelete ?? 0 };
    // }
    //
    // async getUserAccountIdsV2(telegramId: string): Promise<{ accountIds: string[] }> {
    //     const accountIds = await this.accountDiscountRepo.findAccountsByTelegramUser(telegramId);
    //     return { accountIds };
    // }
    //
    // private hasMyDiscountInDiscountList(p: ProductApiResponse['product']): boolean {
    //     const list = p?.personalPrice?.discountList ?? [];
    //     return list.some(x => x?.actionName?.toLowerCase() === 'моя скидка');
    // }
    //
    // private mapBonuses(p: ProductApiResponse['product']): number {
    //     const list = p?.personalPrice?.discountList ?? [];
    //     const item = list.find(x => x?.actionName?.toLowerCase() === 'оплата бонусами');
    //     const raw = item?.summa?.value ?? 0;
    //     return Number(raw) / 100;
    // }
    //
    // private mapPrice(p: ProductApiResponse['product']): number {
    //     const raw = p?.personalPrice?.price?.value ?? 0;
    //     return Number(raw) / 100;
    // }
    //
    // private buildResult(
    //     product: ProductApiResponse['product'],
    //     accountId: string,
    //     bonusCount?: number,
    //     calculateProduct?: { price: number; bonus: number },
    //     ordersToday: number = 0,
    // ): CheckProductResultItem | null {
    //     if (!this.hasMyDiscountInDiscountList(product)) return null;
    //     return {
    //         accountId,
    //         discountRate: product?.price?.discountRate ?? null,
    //         price: this.mapPrice(product),
    //         bonuses: this.mapBonuses(product),
    //         bonusCount,
    //         ordersToday,
    //         calculateProduct,
    //     };
    // }
    //
    // async prepareAccountsForProductCheckV1({ telegramId, nodeId }: PrepareProductCheckRequestDto): Promise<{
    //     accounts: PreparedAccountInfo[];
    // }> {
    //     // 1. аккаунты по телеграму и ноде
    //     const accountIds = await this.accountDiscountRepo.findAccountIdsByTelegramAndNodes(telegramId, nodeId);
    //
    //     if (!accountIds?.length) {
    //         return { accounts: [] };
    //     }
    //
    //     // 2. заказы за сегодня (map accountId -> count)
    //     const ordersTodayMap = await this.orderRepository.countTodayByAccountIds(accountIds);
    //
    //     // 3. бонусы (map accountId -> bonusCount)
    //     const bonusMap = await this.accountRep.getBonusCountByAccountIds(accountIds);
    //
    //     // 4. собрать итоговый список
    //     const accounts: PreparedAccountInfo[] = accountIds.map(accountId => ({
    //         accountId,
    //         bonus: bonusMap[accountId] ?? 0,
    //         ordersNumber: ordersTodayMap[accountId] ?? 0,
    //     }));
    //
    //     return { accounts };
    // }
    //
    // private getHttpStatus(err: any): number | undefined {
    //     return err?.response?.status ?? err?.response?.data?.statusCode;
    // }
    //
    // private isBadRequest400(err: any): boolean {
    //     return this.getHttpStatus(err) === 400;
    // }
    //
    // private isNotFound404(err: any): boolean {
    //     const status = this.getHttpStatus(err);
    //     const msg = err?.response?.data?.message ?? err?.message;
    //     return status === 404 || msg === 'PRODUCT_NOT_FOUND';
    // }
    //

    // async getAccountsForPersonalDiscountV2(
    //     telegramId: string,
    //     productId: string,
    // ): Promise<{
    //     ok: boolean;
    //     product: { productId: string; node: string | null; percent: number };
    //     processed: number;
    //     results: PreparedAccountInfo[];
    //     errors: ErrorItem[];
    // }> {
    //     // --- 1) Находим product + node ---
    //     const info = await this.productService.getProductInfoWithProduct({
    //         productId,
    //     });
    //
    //     const node = info?.product?.node ?? null;
    //     const percent = extractPercentFromNode(node);
    //
    //     const productObj = {
    //         productId,
    //         node,
    //         percent,
    //     };
    //
    //     // --- 2) Ищем аккаунты, на которых есть скидка по этому продукту ---
    //     const accountIds = await this.accountDiscountRepo.findAccountsForProduct(telegramId, productId);
    //
    //     if (!accountIds.length) {
    //         return {
    //             ok: true,
    //             product: productObj,
    //             processed: 0,
    //             results: [],
    //             errors: [],
    //         };
    //     }
    //
    //     // --- 3) Предзагрузка бонусов и заказов ---
    //     const [ordersTodayMap, bonusMap] = await Promise.all([
    //         this.orderRepository.countTodayByAccountIds(accountIds),
    //         this.accountRep.getBonusCountByAccountIds(accountIds),
    //     ]);
    //
    //     const accounts: PreparedAccountInfo[] = accountIds.map(accountId => ({
    //         accountId,
    //         bonus: bonusMap[accountId] ?? 0,
    //         ordersNumber: ordersTodayMap[accountId] ?? 0,
    //     }));
    //
    //     accounts.sort(cmp);
    //
    //     const errors: ErrorItem[] = [];
    //     const MAX_ROUNDS = 3;
    //
    //     // --- 4) Обновляем bonus у топ-3 для повышения точности сортировки ---
    //     for (let round = 1; round <= MAX_ROUNDS; round++) {
    //         const topN = Math.min(3, accounts.length);
    //         if (topN === 0) break;
    //
    //         const topSlice = accounts.slice(0, topN);
    //         const checks = await Promise.allSettled(topSlice.map(a => this.shortInfo(a.accountId)));
    //
    //         let mismatches = 0;
    //
    //         checks.forEach((res, idx) => {
    //             const acc = topSlice[idx];
    //             if (res.status === 'fulfilled') {
    //                 const freshBonus = Number(res.value?.bonusCount ?? 0);
    //
    //                 if (Number.isFinite(freshBonus)) {
    //                     if (freshBonus !== acc.bonus) mismatches++;
    //
    //                     const target = accounts.find(x => x.accountId === acc.accountId);
    //                     if (target) target.bonus = freshBonus;
    //                 }
    //             } else {
    //                 const msg = res.reason?.response?.data?.message ?? res.reason?.message ?? 'SHORTINFO_ERROR';
    //
    //                 errors.push({ accountId: acc.accountId, error: msg });
    //             }
    //         });
    //
    //         if (mismatches >= 2 && round < MAX_ROUNDS) {
    //             accounts.sort(cmp);
    //             continue;
    //         }
    //
    //         break;
    //     }
    //
    //     accounts.sort(cmp);
    //
    //     return {
    //         ok: true,
    //         product: productObj,
    //         processed: accountIds.length,
    //         results: accounts,
    //         errors,
    //     };
    // }
    //
    // async checkProductBatchForPersonalDiscount({ telegramId, isInventory, productId, accountIds }: CheckProductBatchRequestDto): Promise<{
    //     ok: boolean;
    //     productId: string;
    //     processed: number;
    //     results: CheckProductResultItem[];
    //     errors: CheckProductResultItem[];
    // }> {
    //     if (!accountIds?.length) {
    //         return { ok: true, productId, processed: 0, results: [], errors: [] };
    //     }
    //
    //     const ordersTodayMap = await this.orderRepository.countTodayByAccountIds(accountIds);
    //
    //     const results: CheckProductResultItem[] = [];
    //     const errors: CheckProductResultItem[] = [];
    //
    //     const [probeId, ...restIds] = accountIds;
    //
    //     try {
    //         const probeRes = await this.getProductById(probeId, productId);
    //         const product = probeRes?.product;
    //         if (!product?.id) {
    //             // защитный вариант: нет id продукта в 200-ответе — считаем локальной проблемой
    //             errors.push({ accountId: probeId, error: 'NO_PRODUCT' });
    //         } else {
    //             let bonusCount: number | undefined;
    //             if (this.hasMyDiscountInDiscountList(product)) {
    //                 try {
    //                     const short = await this.shortInfo(probeId);
    //                     bonusCount = short?.bonusCount;
    //                 } catch {
    //                     /* не критично */
    //                 }
    //             }
    //             const calc = this.calculateService.computeCalculateProductFromProduct(product, isInventory);
    //             const mapped = this.buildResult(product, probeId, bonusCount, calc || undefined, ordersTodayMap[probeId] ?? 0);
    //             if (mapped) results.push(mapped);
    //         }
    //     } catch (e: any) {
    //         if (this.isNotFound404(e)) {
    //             // 404 на пробном — глобально для всех
    //             throw new NotFoundException('PRODUCT_NOT_FOUND');
    //         }
    //         // 400 на пробном — локальная ошибка этого аккаунта, остальные продолжаем
    //         const errorText = this.isBadRequest400(e)
    //             ? e?.response?.data?.message ?? 'BAD_REQUEST'
    //             : e?.response?.data?.message ?? e?.message ?? 'UNKNOWN_ERROR';
    //         errors.push({ accountId: probeId, error: errorText });
    //     }
    //
    //     // --- ОСТАЛЬНЫЕ АККАУНТЫ ---
    //     const worker = async (accountId: string): Promise<void> => {
    //         try {
    //             const res = await this.getProductById(accountId, productId);
    //             const product = res?.product;
    //             if (!product?.id) {
    //                 errors.push({ accountId, error: 'NO_PRODUCT' });
    //                 return;
    //             }
    //
    //             let bonusCount: number | undefined;
    //             if (this.hasMyDiscountInDiscountList(product)) {
    //                 try {
    //                     const short = await this.shortInfo(accountId);
    //                     bonusCount = short?.bonusCount;
    //                 } catch {
    //                     /* ignore */
    //                 }
    //             }
    //
    //             const calc = this.calculateService.computeCalculateProductFromProduct(product, isInventory);
    //             const mapped = this.buildResult(product, accountId, bonusCount, calc || undefined, ordersTodayMap[accountId] ?? 0);
    //             if (mapped) results.push(mapped);
    //         } catch (err: any) {
    //             // для остальных — любые 4xx/5xx считаем локальными
    //             const errorText = err?.response?.data?.message ?? err?.message ?? 'UNKNOWN_ERROR';
    //             errors.push({ accountId, error: errorText });
    //         }
    //     };
    //
    //     for (let i = 0; i < restIds.length; i += this.MAX_CONCURRENCY) {
    //         const slice = restIds.slice(i, i + this.MAX_CONCURRENCY);
    //         await Promise.all(slice.map(id => worker(id)));
    //     }
    //
    //     return {
    //         ok: true,
    //         productId,
    //         processed: accountIds.length,
    //         results,
    //         errors,
    //     };
    // }
}
