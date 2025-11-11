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
            where: {
                telegramId,
            },
            select: {
                accountId: true,
            },
            distinct: ['accountId'],
        });
        return records.map(r => r.accountId);
    }

    async deleteDataForAccount(accountId: string, telegramId: string) {
        const { count } = await this.prisma.accountDiscountProduct.deleteMany({
            where: {
                accountId,
                telegramId,
            },
        });
        return count;
    }

    async findAccountsForProduct(telegramId: string, productId: string) {
        const records = await this.prisma.accountDiscountProduct.findMany({
            where: {
                productId,
                telegramId,
            },
            select: {
                accountId: true,
            },
        });
        return records.map(r => r.accountId);
    }

    async upsertManyDiscountProducts(items: UpsertPersonalDiscountProductsInput[]): Promise<void> {
        if (!items.length) return;

        await this.prisma.$transaction(
            items.map(i =>
                this.prisma.accountDiscountProduct.upsert({
                    where: { productId_telegramId_accountId: { productId: i.productId, telegramId: i.telegramId, accountId: i.accountId } },
                    create: {
                        productId: i.productId,
                        accountId: i.accountId,
                        telegramId: i.telegramId,
                        dateEnd: i.dateEnd,
                    },
                    update: {
                        dateEnd: i.dateEnd,
                    },
                }),
            ),
        );
    }
}
