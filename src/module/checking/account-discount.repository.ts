import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import {
    AccountDiscountsToInsert,
    CreatePersonalDiscountProductsInput,
    NodeForAccount,
    NodePair,
    UpsertNodeDiscountInput,
} from './interfaces/account-discount.interface';

@Injectable()
export class AccountDiscountRepository {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Полная очистка всех таблиц скидок с сбросом индексов
     */
    async fullCleanupAllDiscountData(): Promise<void> {
        await this.prisma.$executeRawUnsafe(`
        TRUNCATE TABLE 
        "account_discount_product", 
        "account_discount", 
        "product_info", 
        "node_product" 
        RESTART IDENTITY CASCADE;
    `);
    }

    /**
     * Получить все уникальные telegramId из AccountDiscount
     */
    async findAllDistinctTelegramIds(): Promise<string[]> {
        const rows = await this.prisma.accountDiscount.findMany({
            select: { telegramId: true },
            distinct: ['telegramId'],
        });
        return rows.map(r => r.telegramId);
    }

    /**
     * Получить все аккаунты сгруппированные по telegramId
     */
    async findAllAccountsGroupedByTelegram(): Promise<Map<string, string[]>> {
        const rows = await this.prisma.accountDiscount.findMany({
            select: { telegramId: true, accountId: true },
            distinct: ['telegramId', 'accountId'],
        });
        const map = new Map<string, string[]>();
        for (const row of rows) {
            const list = map.get(row.telegramId) || [];
            list.push(row.accountId);
            map.set(row.telegramId, list);
        }
        return map;
    }

    async upsertNodeDiscount(node: UpsertNodeDiscountInput) {
        return this.prisma.nodeDiscount.upsert({
            where: { nodeId: node.nodeId },
            create: {
                nodeId: node.nodeId,
                nodeName: node.nodeName,
                url: node.url,
                dateEnd: node.dateEnd,
            },
            update: {},
        });
    }

    async ensureNodesExist(nodes: UpsertNodeDiscountInput[]): Promise<void> {
        if (!nodes.length) return;

        // createMany с skipDuplicates работает быстрее upsertMany
        await this.prisma.nodeDiscount.createMany({
            data: nodes.map(n => ({
                nodeId: n.nodeId,
                nodeName: n.nodeName,
                url: n.url,
                dateEnd: n.dateEnd,
            })),
            skipDuplicates: true,
        });
    }

    async deleteAccountDiscountsBatch(accountIds: string[], telegramId: string): Promise<void> {
        if (!accountIds.length) return;

        await this.prisma.$transaction([
            this.prisma.accountDiscountProduct.deleteMany({
                where: { accountId: { in: accountIds }, telegramId },
            }),
            this.prisma.accountDiscount.deleteMany({
                where: { accountId: { in: accountIds }, telegramId },
            }),
        ]);
    }

    async deleteAllByTelegramId(telegramId: string): Promise<number> {
        const [res1, res2] = await this.prisma.$transaction([
            this.prisma.accountDiscountProduct.deleteMany({
                where: { telegramId },
            }),
            this.prisma.accountDiscount.deleteMany({
                where: { telegramId },
            }),
        ]);
        return res1.count + res2.count;
    }

    async createAccountDiscountsBatch(items: AccountDiscountsToInsert[]): Promise<void> {
        if (!items.length) return;

        await this.prisma.accountDiscount.createMany({
            data: items,
            skipDuplicates: true,
        });
    }

    async findNodesForAccounts(telegramId: string, accountIds: string[]): Promise<NodeForAccount[]> {
        return this.prisma.accountDiscount.findMany({
            where: {
                telegramId,
                accountId: { in: accountIds },
            },
            select: {
                accountId: true,
                node: {
                    select: {
                        url: true,
                        nodeId: true,
                    },
                },
            },
        });
    }

    // Исправленный bulkInsertProductInfos (с пропуском дублей)
    async bulkInsertProductInfos(infos: { productId: string; article: string; sku: string | null }[]) {
        if (!infos.length) return;

        // Доп. защита от дублей внутри пачки перед отправкой в БД (Prisma может ругаться, если в values есть дубли)
        const uniqueInfos = Array.from(new Map(infos.map(i => [`${i.productId}:${i.article}:${i.sku}`, i])).values());

        return this.prisma.productInfo.createMany({
            data: uniqueInfos,
            skipDuplicates: true,
        });
    }

    /**
     * Массовый insert в account_discount_product.
     * 1) Убираем дубли по (productId, telegramId, accountId) на уровне JS.
     * 2) Делаем один createMany с skipDuplicates: true.
     */
    async createManyDiscountProducts(items: CreatePersonalDiscountProductsInput[]): Promise<void> {
        if (!items.length) return;

        // дедупликация в памяти, чтобы не гнать лишние дубликаты в createMany
        const dedupMap = new Map<string, CreatePersonalDiscountProductsInput>();
        for (const i of items) {
            const key = `${i.productId}|${i.telegramId}|${i.accountId}`;
            if (!dedupMap.has(key)) {
                dedupMap.set(key, i);
            }
        }

        const data = Array.from(dedupMap.values()).map(i => ({
            productId: i.productId,
            accountId: i.accountId,
            telegramId: i.telegramId,
            nodeId: i.nodeId,
        }));

        if (!data.length) return;

        await this.prisma.accountDiscountProduct.createMany({
            data,
            skipDuplicates: true,
        });
    }

    async findDistinctNodePairsByTelegram(telegramId: string): Promise<NodePair[]> {
        return this.prisma.nodeDiscount.findMany({
            where: {
                AccountDiscount: {
                    some: {
                        telegramId: telegramId,
                    },
                },
            },
            select: {
                nodeId: true,
                nodeName: true,
            },
        });
    }

    async findDistinctAccountIdsByTelegram(telegramId: string): Promise<string[]> {
        const rows = await this.prisma.accountDiscount.findMany({
            where: { telegramId },
            select: { accountId: true },
            distinct: ['accountId'],
        });
        return rows.map(r => r.accountId);
    }

    async findAccountIdsByTelegramAndNodes(telegramId: string, nodeIds: string[]): Promise<string[]> {
        if (!nodeIds?.length) return [];
        const rows = await this.prisma.accountDiscount.findMany({
            where: { telegramId, nodeId: { in: nodeIds } },
            select: { accountId: true },
            distinct: ['accountId'],
        });
        return rows.map(r => r.accountId);
    }

    async findAccountsByTelegramUser(telegramId: string) {
        const records = await this.prisma.accountDiscountProduct.findMany({
            where: { telegramId },
            select: { accountId: true },
            distinct: ['accountId'],
        });
        return records.map(r => r.accountId);
    }

    async findAccountsForProduct(telegramId: string, productId: string) {
        const records = await this.prisma.accountDiscountProduct.findMany({
            where: { productId, telegramId },
            select: { accountId: true },
        });
        return records.map(r => r.accountId);
    }

    async findProductsByVariant(query: string) {
        return this.prisma.productInfo.findMany({
            where: {
                OR: [{ productId: query }, { sku: query }, { article: { startsWith: query } }],
            },
        });
    }
}
