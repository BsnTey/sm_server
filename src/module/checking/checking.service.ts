import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { List, Products } from '../account/interfaces/products.interface';
import { chunk, cmp, requestWithBackoff, startOfNextDayUTC } from './utils/set-products.utils';
import { SetPersonalDiscountAccountRequestDto } from './dto/set-personal-discount.dto';
import { RABBIT_MQ_QUEUES } from '@common/broker/rabbitmq.queues';
import { NodePair, UpsertPersonalDiscountProductsInput } from './interfaces/account-discount.interface';
import { keyDiscountAccount, keyDiscountNodes } from './cache-key/key';
import { AccountTelegramParamsDto } from '../account/dto/account-telegram-ids.dto';
import { ProductApiResponse } from '../account/interfaces/product.interface';
import { CheckProductBatchRequestDto, PrepareProductCheckRequestDto } from './dto/check-product.prepare.dto';
import { PreparedAccountInfo } from './interfaces/extend-chrome.interface';
import { ErrorItem } from '../account/interfaces/personal-discount.interface';
import { extractPercentFromNode } from '../account/utils/extract.utils';
import { ConfigService } from '@nestjs/config';
import { AccountDiscountRepository } from '../account/account-discount.repository';
import { OrderRepository } from '../account/order.repository';
import { ProxyService } from '../proxy/proxy.service';
import { CalculateService } from '../calculate/calculate.service';
import { DelayedPublisher } from '@common/broker/delayed.publisher';
import { ProductService } from '../product/product.service';
import { CacheService } from '../cache/cache.service';
import { AccountService } from '../account/account.service';
import { parseDateFlexible } from '../account/utils/parse-data';
import { UserService } from '../user/user.service';
import { AccountWithProxyEntity } from '../account/entities/accountWithProxy.entity';

@Injectable()
export class CheckingService {
    private readonly logger = new Logger(CheckingService.name);
    private TTL_CASH_DISCOUNT = 10_800_000;
    private readonly MAX_CONCURRENCY = 5;
    private readonly PRODUCT_WRITE_CONCURRENCY = 5;
    private readonly PAGE_SIZE = 100;
    private readonly DB_CHUNK = 200;
    private readonly PERSONAL_DISCOUNT_BATCH_SIZE = 5;
    private readonly PERSONAL_DISCOUNT_RATE_SECONDS = 80;

    constructor(
        private configService: ConfigService,
        private accountService: AccountService,
        private accountDiscountRepo: AccountDiscountRepository,
        private orderRepository: OrderRepository,
        private proxyService: ProxyService,
        private calculateService: CalculateService,
        private readonly publisher: DelayedPublisher,
        private readonly productService: ProductService,
        private readonly cacheService: CacheService,
        private readonly userService: UserService,
    ) {}

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

    //принимает входящие аккаунты, сейвит в очередь на нарезку под прокси chunkingAccountForProxy
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

    async start(data: SetPersonalDiscountAccountRequestDto) {
        const telegramId = data.telegramId;
        const accountIds = data.personalDiscounts;

        const results: Array<AccountWithProxyEntity> = [];

        for (const partAcc of chunk(accountIds, this.MAX_CONCURRENCY)) {
            const settled = await Promise.allSettled(partAcc.map(accountId => this.accountService.getAccountEntity(accountId)));

            settled.forEach(resultPromise => {
                if (resultPromise.status === 'fulfilled') {
                    results.push(resultPromise.value);
                }
            });
        }
        const resultChanks: Array<Array<AccountWithProxyEntity>> = [];
        //нарезать results по 5 аккаунтов в чанке по разным прокси, которые в аккаунтах results[0].proxy.uuid
        //передать в другую очередь где будет обьект {telegramId, accounts: Array<AccountWithProxyEntity>, count, total}
        // Где count - номер чанка, total - всего чанков
    }

    async queueAccounts(data: SetPersonalDiscountAccountRequestDto): Promise<{
        ok: boolean;
        estimatedSeconds: number;
    }> {
        const normalized = data.personalDiscounts.map(id => id.trim()).filter(Boolean);
        const uniqueAccountIds = Array.from(new Set(normalized));

        if (!uniqueAccountIds.length) {
            throw new HttpException('No valid accounts provided', HttpStatus.BAD_REQUEST);
        }

        const batches = Array.from(chunk(uniqueAccountIds, this.PERSONAL_DISCOUNT_BATCH_SIZE));

        await Promise.all(
            batches.map(batch =>
                this.publisher.publish(
                    RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_QUEUE,
                    {
                        telegramId: data.telegramId,
                        personalDiscounts: batch,
                    },
                    0,
                ),
            ),
        );

        const estimatedSeconds = batches.length * this.PERSONAL_DISCOUNT_RATE_SECONDS;

        this.logger.log(
            `Queued ${uniqueAccountIds.length} accounts for personal discount (telegramId=${data.telegramId}, batches=${batches.length})`,
        );

        return {
            ok: true,
            estimatedSeconds,
        };
    }

    // воркер наполнения AccountDiscount для одного accountId
    private async workerAccountDiscount(accountId: string, telegramId: string) {
        const pd = await this.accountService.personalDiscount(accountId);

        const items =
            pd?.list?.map(l => {
                const raw = l.dateEnd;
                const parsed = parseDateFlexible(raw);

                return {
                    nodeId: l.base.nodeId,
                    nodeName: l.nodeName,
                    url: l.url,
                    dateEnd: parsed,
                };
            }) ?? [];

        const valid = items.filter(x => x.nodeId && x.nodeName && !isNaN(x.dateEnd.getTime()));

        if (valid.length) {
            await this.accountDiscountRepo.upsertMany(accountId, telegramId, valid);
        }

        return { accountId, saved: valid.length };
    }

    async setAccountsForPersonalDiscount(data: SetPersonalDiscountAccountRequestDto): Promise<{
        ok: boolean;
        results: Array<{ accountId: string; saved: number }>;
        errors: Array<{ accountId: string; message: string }>;
    }> {
        const { telegramId, personalDiscounts } = data;

        const keyNodes = keyDiscountNodes(telegramId);
        const keyAccounts = keyDiscountAccount(telegramId);

        const results: Array<{ accountId: string; saved: number }> = [];
        const errors: Array<{ accountId: string; message: string }> = [];

        for (const part of chunk(personalDiscounts, this.MAX_CONCURRENCY)) {
            const settled = await Promise.allSettled(part.map(accountId => this.workerAccountDiscount(accountId, telegramId)));

            settled.forEach((r, idx) => {
                const accountId = part[idx];
                if (r.status === 'fulfilled') {
                    results.push({ accountId, saved: r.value.saved });
                } else {
                    errors.push({
                        accountId,
                        message: r.reason?.message ?? 'Unknown error',
                    });
                }
            });
        }

        await Promise.allSettled([this.cacheService.del(keyNodes), this.cacheService.del(keyAccounts)]);

        return { ok: errors.length === 0, results, errors };
    }

    async setAccountsDiscountProduct(data: SetPersonalDiscountAccountRequestDto): Promise<{
        ok: boolean;
        results: Array<{ accountId: string; saved: number }>;
        errors: Array<{ accountId: string; message: string }>;
    }> {
        const { telegramId, personalDiscounts } = data;
        const results: Array<{ accountId: string; saved: number }> = [];
        const errors: Array<{ accountId: string; message: string }> = [];

        // Буферы для справочников (Product, ProductInfo)
        // Используем Map, чтобы внутри батча убрать дубликаты перед отправкой в БД
        const productBuffer = new Map<string, string>();
        const infoBuffer = new Map<string, { productId: string; article: string; sku: string | null }>();

        // Функция для сброса буфера справочников в БД
        const flushProductBuffers = async () => {
            if (productBuffer.size === 0 && infoBuffer.size === 0) return;

            const productsToSave = Array.from(productBuffer.entries()).map(([productId, node]) => ({ productId, node }));
            const infosToSave = Array.from(infoBuffer.values());

            // Очищаем буферы СРАЗУ, чтобы освободить память, пока идет запись
            productBuffer.clear();
            infoBuffer.clear();

            try {
                // Пишем пачками, используя createMany (намного быстрее)
                await this.accountDiscountRepo.bulkUpsertProducts(productsToSave);
                await this.accountDiscountRepo.bulkInsertProductInfos(infosToSave);
            } catch (e) {
                this.logger.error('Error flushing product dictionaries', e);
                // Не падаем, так как это справочная информация,
                // но лучше залогировать, чтобы потом разобраться.
            }
        };

        const worker = async (accountId: string) => {
            const pd = await this.personalDiscount(accountId);

            const urlNodes = (pd?.list ?? []).map(n => ({
                url: n.url,
                name: n.nodeName,
                dateEnd: startOfNextDayUTC(n.dateEnd),
            }));

            let savedTotal = 0;

            for (const node of urlNodes) {
                const discountBuffer: UpsertPersonalDiscountProductsInput[] = [];

                for await (const page of this.paginateProducts(
                    accountId,
                    node.url,
                    this.PAGE_SIZE,
                    20,
                    this.findProductsBySearch.bind(this),
                )) {
                    for (const it of page) {
                        const productId = String(it.id);

                        // 1. Добавляем в буфер связи Аккаунт-Скидка
                        discountBuffer.push({
                            productId,
                            telegramId: String(telegramId),
                            accountId,
                            dateEnd: node.dateEnd,
                        });

                        // 2. Добавляем в буфер справочника Product
                        if (!productBuffer.has(productId)) {
                            productBuffer.set(productId, node.name);
                        }

                        // 3. Добавляем в буфер справочника ProductInfo
                        if (Array.isArray(it.skus) && it.skus.length) {
                            for (const skuItem of it.skus) {
                                const article = skuItem.code;
                                const sku = skuItem.id;
                                // Ключ для уникальности внутри пачки
                                const key = `${productId}|${article}|${sku}`;
                                if (!infoBuffer.has(key)) {
                                    infoBuffer.set(key, { productId, article, sku });
                                }
                            }
                        } else {
                            const article = it.code;
                            const key = `${productId}|${article}|null`;
                            if (!infoBuffer.has(key)) {
                                infoBuffer.set(key, { productId, article, sku: null });
                            }
                        }
                    }

                    // Сброс буфера скидок (AccountDiscountProduct)
                    if (discountBuffer.length >= this.DB_CHUNK) {
                        const unique = Array.from(
                            new Map(discountBuffer.map(x => [`${x.productId}|${x.telegramId}|${x.accountId}`, x])).values(),
                        );
                        for (const part of chunk(unique, this.DB_CHUNK)) {
                            await this.accountDiscountRepo.upsertManyDiscountProducts(part);
                            savedTotal += part.length;
                        }
                        discountBuffer.length = 0;
                    }

                    // !!! Сброс буферов СПРАВОЧНИКОВ (Product / ProductInfo)
                    // Если накопилось много данных (например > 1000), сбрасываем в БД
                    if (productBuffer.size > 1000 || infoBuffer.size > 1000) {
                        await flushProductBuffers();
                    }
                }

                // Дописываем остатки скидок
                if (discountBuffer.length) {
                    const unique = Array.from(
                        new Map(discountBuffer.map(x => [`${x.productId}|${x.telegramId}|${x.accountId}`, x])).values(),
                    );
                    for (const part of chunk(unique, this.DB_CHUNK)) {
                        await this.accountDiscountRepo.upsertManyDiscountProducts(part);
                        savedTotal += part.length;
                    }
                }
            }

            return { accountId, saved: savedTotal };
        };

        // Обработка аккаунтов
        for (const part of chunk(personalDiscounts, this.MAX_CONCURRENCY)) {
            const settled = await Promise.allSettled(part.map(a => worker(a)));

            settled.forEach((r, idx) => {
                const accountId = part[idx];
                if (r.status === 'fulfilled') {
                    results.push({ accountId, saved: r.value.saved });
                } else {
                    errors.push({ accountId, message: r.reason?.message ?? 'Unknown error' });
                }
            });

            // После обработки пачки аккаунтов - обязательно сбрасываем остатки справочников
            await flushProductBuffers();
        }

        // Финальный сброс на всякий случай (хотя flush внутри цикла выше должен был сработать)
        await flushProductBuffers();

        return { ok: errors.length === 0, results, errors };
    }

    async getDistinctNodePairsByTelegram(telegramId: string): Promise<{ nodes: NodePair[] }> {
        const key = keyDiscountNodes(telegramId);

        const nodesCache = await this.cacheManager.get<NodePair[]>(key);

        if (nodesCache) return { nodes: nodesCache };

        const nodes = await this.accountDiscountRepo.findDistinctNodePairsByTelegram(telegramId);

        await this.cacheManager.set(key, nodes, this.TTL_CASH_DISCOUNT);

        return { nodes };
    }

    async removeDiscountsByAccountIdV1({ telegramId, accountId }: AccountTelegramParamsDto): Promise<{
        deleted: number;
    }> {
        const countDelete = await this.accountDiscountRepo.deleteDataForAccount(accountId, telegramId);

        return { deleted: countDelete ?? 0 };
    }

    async getUserAccountIdsV2(telegramId: string): Promise<{ accountIds: string[] }> {
        const accountIds = await this.accountDiscountRepo.findAccountsByTelegramUser(telegramId);
        return { accountIds };
    }

    private hasMyDiscountInDiscountList(p: ProductApiResponse['product']): boolean {
        const list = p?.personalPrice?.discountList ?? [];
        return list.some(x => x?.actionName?.toLowerCase() === 'моя скидка');
    }

    private mapBonuses(p: ProductApiResponse['product']): number {
        const list = p?.personalPrice?.discountList ?? [];
        const item = list.find(x => x?.actionName?.toLowerCase() === 'оплата бонусами');
        const raw = item?.summa?.value ?? 0;
        return Number(raw) / 100;
    }

    private mapPrice(p: ProductApiResponse['product']): number {
        const raw = p?.personalPrice?.price?.value ?? 0;
        return Number(raw) / 100;
    }

    private buildResult(
        product: ProductApiResponse['product'],
        accountId: string,
        bonusCount?: number,
        calculateProduct?: { price: number; bonus: number },
        ordersToday: number = 0,
    ): CheckProductResultItem | null {
        if (!this.hasMyDiscountInDiscountList(product)) return null;
        return {
            accountId,
            discountRate: product?.price?.discountRate ?? null,
            price: this.mapPrice(product),
            bonuses: this.mapBonuses(product),
            bonusCount,
            ordersToday,
            calculateProduct,
        };
    }

    async prepareAccountsForProductCheckV1({ telegramId, nodeId }: PrepareProductCheckRequestDto): Promise<{
        accounts: PreparedAccountInfo[];
    }> {
        // 1. аккаунты по телеграму и ноде
        const accountIds = await this.accountDiscountRepo.findAccountIdsByTelegramAndNodes(telegramId, nodeId);

        if (!accountIds?.length) {
            return { accounts: [] };
        }

        // 2. заказы за сегодня (map accountId -> count)
        const ordersTodayMap = await this.orderRepository.countTodayByAccountIds(accountIds);

        // 3. бонусы (map accountId -> bonusCount)
        const bonusMap = await this.accountRep.getBonusCountByAccountIds(accountIds);

        // 4. собрать итоговый список
        const accounts: PreparedAccountInfo[] = accountIds.map(accountId => ({
            accountId,
            bonus: bonusMap[accountId] ?? 0,
            ordersNumber: ordersTodayMap[accountId] ?? 0,
        }));

        return { accounts };
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

    async getAccountsForPersonalDiscountV2(
        telegramId: string,
        productId: string,
    ): Promise<{
        ok: boolean;
        product: { productId: string; node: string | null; percent: number };
        processed: number;
        results: PreparedAccountInfo[];
        errors: ErrorItem[];
    }> {
        // --- 1) Находим product + node ---
        const info = await this.productService.getProductInfoWithProduct({
            productId,
        });

        const node = info?.product?.node ?? null;
        const percent = extractPercentFromNode(node);

        const productObj = {
            productId,
            node,
            percent,
        };

        // --- 2) Ищем аккаунты, на которых есть скидка по этому продукту ---
        const accountIds = await this.accountDiscountRepo.findAccountsForProduct(telegramId, productId);

        if (!accountIds.length) {
            return {
                ok: true,
                product: productObj,
                processed: 0,
                results: [],
                errors: [],
            };
        }

        // --- 3) Предзагрузка бонусов и заказов ---
        const [ordersTodayMap, bonusMap] = await Promise.all([
            this.orderRepository.countTodayByAccountIds(accountIds),
            this.accountRep.getBonusCountByAccountIds(accountIds),
        ]);

        const accounts: PreparedAccountInfo[] = accountIds.map(accountId => ({
            accountId,
            bonus: bonusMap[accountId] ?? 0,
            ordersNumber: ordersTodayMap[accountId] ?? 0,
        }));

        accounts.sort(cmp);

        const errors: ErrorItem[] = [];
        const MAX_ROUNDS = 3;

        // --- 4) Обновляем bonus у топ-3 для повышения точности сортировки ---
        for (let round = 1; round <= MAX_ROUNDS; round++) {
            const topN = Math.min(3, accounts.length);
            if (topN === 0) break;

            const topSlice = accounts.slice(0, topN);
            const checks = await Promise.allSettled(topSlice.map(a => this.shortInfo(a.accountId)));

            let mismatches = 0;

            checks.forEach((res, idx) => {
                const acc = topSlice[idx];
                if (res.status === 'fulfilled') {
                    const freshBonus = Number(res.value?.bonusCount ?? 0);

                    if (Number.isFinite(freshBonus)) {
                        if (freshBonus !== acc.bonus) mismatches++;

                        const target = accounts.find(x => x.accountId === acc.accountId);
                        if (target) target.bonus = freshBonus;
                    }
                } else {
                    const msg = res.reason?.response?.data?.message ?? res.reason?.message ?? 'SHORTINFO_ERROR';

                    errors.push({ accountId: acc.accountId, error: msg });
                }
            });

            if (mismatches >= 2 && round < MAX_ROUNDS) {
                accounts.sort(cmp);
                continue;
            }

            break;
        }

        accounts.sort(cmp);

        return {
            ok: true,
            product: productObj,
            processed: accountIds.length,
            results: accounts,
            errors,
        };
    }

    async checkProductBatchForPersonalDiscount({ telegramId, isInventory, productId, accountIds }: CheckProductBatchRequestDto): Promise<{
        ok: boolean;
        productId: string;
        processed: number;
        results: CheckProductResultItem[];
        errors: CheckProductResultItem[];
    }> {
        if (!accountIds?.length) {
            return { ok: true, productId, processed: 0, results: [], errors: [] };
        }

        const ordersTodayMap = await this.orderRepository.countTodayByAccountIds(accountIds);

        const results: CheckProductResultItem[] = [];
        const errors: CheckProductResultItem[] = [];

        const [probeId, ...restIds] = accountIds;

        try {
            const probeRes = await this.getProductById(probeId, productId);
            const product = probeRes?.product;
            if (!product?.id) {
                // защитный вариант: нет id продукта в 200-ответе — считаем локальной проблемой
                errors.push({ accountId: probeId, error: 'NO_PRODUCT' });
            } else {
                let bonusCount: number | undefined;
                if (this.hasMyDiscountInDiscountList(product)) {
                    try {
                        const short = await this.shortInfo(probeId);
                        bonusCount = short?.bonusCount;
                    } catch {
                        /* не критично */
                    }
                }
                const calc = this.calculateService.computeCalculateProductFromProduct(product, isInventory);
                const mapped = this.buildResult(product, probeId, bonusCount, calc || undefined, ordersTodayMap[probeId] ?? 0);
                if (mapped) results.push(mapped);
            }
        } catch (e: any) {
            if (this.isNotFound404(e)) {
                // 404 на пробном — глобально для всех
                throw new NotFoundException('PRODUCT_NOT_FOUND');
            }
            // 400 на пробном — локальная ошибка этого аккаунта, остальные продолжаем
            const errorText = this.isBadRequest400(e)
                ? e?.response?.data?.message ?? 'BAD_REQUEST'
                : e?.response?.data?.message ?? e?.message ?? 'UNKNOWN_ERROR';
            errors.push({ accountId: probeId, error: errorText });
        }

        // --- ОСТАЛЬНЫЕ АККАУНТЫ ---
        const worker = async (accountId: string): Promise<void> => {
            try {
                const res = await this.getProductById(accountId, productId);
                const product = res?.product;
                if (!product?.id) {
                    errors.push({ accountId, error: 'NO_PRODUCT' });
                    return;
                }

                let bonusCount: number | undefined;
                if (this.hasMyDiscountInDiscountList(product)) {
                    try {
                        const short = await this.shortInfo(accountId);
                        bonusCount = short?.bonusCount;
                    } catch {
                        /* ignore */
                    }
                }

                const calc = this.calculateService.computeCalculateProductFromProduct(product, isInventory);
                const mapped = this.buildResult(product, accountId, bonusCount, calc || undefined, ordersTodayMap[accountId] ?? 0);
                if (mapped) results.push(mapped);
            } catch (err: any) {
                // для остальных — любые 4xx/5xx считаем локальными
                const errorText = err?.response?.data?.message ?? err?.message ?? 'UNKNOWN_ERROR';
                errors.push({ accountId, error: errorText });
            }
        };

        for (let i = 0; i < restIds.length; i += this.MAX_CONCURRENCY) {
            const slice = restIds.slice(i, i + this.MAX_CONCURRENCY);
            await Promise.all(slice.map(id => worker(id)));
        }

        return {
            ok: true,
            productId,
            processed: accountIds.length,
            results,
            errors,
        };
    }
}
