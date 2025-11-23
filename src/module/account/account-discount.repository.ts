import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { NodePair, UpsertPersonalDiscountInput, UpsertPersonalDiscountProductsInput } from './interfaces/account-discount.interface';

@Injectable()
export class AccountDiscountRepository {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Для каждого (accountId,nodeId,telegramId) — upsert.
     * В update НЕ трогаем telegramId, чтобы не «переезжал» владелец.
     */
    async upsertMany(
        accountId: string,
        telegramId: string,
        items: Array<Pick<UpsertPersonalDiscountInput, 'nodeId' | 'nodeName' | 'dateEnd'>>,
    ): Promise<void> {
        if (!items.length) return;

        await this.prisma.$transaction(
            items.map(i =>
                this.prisma.accountDiscount.upsert({
                    where: {
                        account_node_telegram_unique: {
                            accountId,
                            nodeId: i.nodeId,
                            telegramId,
                        },
                    },
                    create: {
                        accountId,
                        telegramId,
                        nodeId: i.nodeId,
                        nodeName: i.nodeName,
                        dateEnd: i.dateEnd,
                    },
                    update: {
                        nodeName: i.nodeName,
                        dateEnd: i.dateEnd,
                    },
                }),
            ),
        );
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
