import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import {
    AccountDiscountsToInsert,
    NodePair,
    UpsertNodeDiscountInput,
    UpsertPersonalDiscountInput,
    UpsertPersonalDiscountProductsInput,
} from './interfaces/account-discount.interface';

@Injectable()
export class AccountDiscountRepository {
    constructor(private readonly prisma: PrismaService) {}

    async clearAccountData(accountId: string): Promise<void> {
        if (!accountId) return;

        await this.prisma.$transaction([
            this.prisma.accountDiscountProduct.deleteMany({
                where: {
                    accountId: accountId,
                },
            }),

            this.prisma.accountDiscount.deleteMany({
                where: {
                    accountId: accountId,
                },
            }),
        ]);
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

    // Атомарная замена данных для группы аккаунтов
    async refreshAccountDiscountsBatch(accountIds: string[], items: AccountDiscountsToInsert[]): Promise<void> {
        if (!accountIds.length) return;

        await this.prisma.$transaction([
            // 1. Массово удаляем продукты для списка аккаунтов
            this.prisma.accountDiscountProduct.deleteMany({
                where: { accountId: { in: accountIds } },
            }),
            // 2. Массово удаляем скидки для списка аккаунтов
            this.prisma.accountDiscount.deleteMany({
                where: { accountId: { in: accountIds } },
            }),
            // 3. Массово вставляем новые связи (если есть что вставлять)
            ...(items.length > 0
                ? [
                      this.prisma.accountDiscount.createMany({
                          data: items,
                          skipDuplicates: true,
                      }),
                  ]
                : []),
        ]);
    }

    async findDistinctNodePairsByTelegram(telegramId: string): Promise<NodePair[]> {
        return this.prisma.accountDiscount.findMany({
            where: { telegramId },
            select: { nodeId: true, nodeName: true },
            distinct: ['nodeId', 'nodeName'],
        });
    }

    async deleteByAccountAndTelegram(accountId: string, telegramId: string): Promise<number> {
        const res = await this.prisma.accountDiscount.deleteMany({
            where: { accountId, telegramId },
        });
        return res.count;
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

    //функции для нового поиска
    async findAccountsByTelegramUser(telegramId: string) {
        const records = await this.prisma.accountDiscountProduct.findMany({
            where: { telegramId },
            select: { accountId: true },
            distinct: ['accountId'],
        });
        return records.map(r => r.accountId);
    }

    async deleteDataForAccount(accountId: string, telegramId: string) {
        const { count } = await this.prisma.accountDiscountProduct.deleteMany({
            where: { accountId, telegramId },
        });
        return count;
    }

    async findAccountsForProduct(telegramId: string, productId: string) {
        const records = await this.prisma.accountDiscountProduct.findMany({
            where: { productId, telegramId },
            select: { accountId: true },
        });
        return records.map(r => r.accountId);
    }

    /**
     * Массовый insert в account_discount_product.
     * 1) Убираем дубли по (productId, telegramId, accountId) на уровне JS.
     * 2) Делаем один createMany с skipDuplicates: true.
     *
     * Важно: при таком подходе dateEnd НЕ обновится, если запись уже существует.
     * Если критично тащить актуальный dateEnd — нужно будет делать отдельный updateMany/сырое SQL.
     */
    async upsertManyDiscountProducts(items: UpsertPersonalDiscountProductsInput[]): Promise<void> {
        if (!items.length) return;

        // дедупликация в памяти, чтобы не гнать лишние дубликаты в createMany
        const dedupMap = new Map<string, UpsertPersonalDiscountProductsInput>();
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
            dateEnd: i.dateEnd,
        }));

        if (!data.length) return;

        await this.prisma.accountDiscountProduct.createMany({
            data,
            skipDuplicates: true,
        });
    }

    async bulkUpsertProducts(products: { productId: string; node: string }[]) {
        if (!products.length) return;
        return this.prisma.product.createMany({
            data: products,
            skipDuplicates: true,
        });
    }

    async bulkInsertProductInfos(infos: { productId: string; article: string; sku: string | null }[]) {
        if (!infos.length) return;
        return this.prisma.productInfo.createMany({
            data: infos,
            skipDuplicates: true,
        });
    }
}
