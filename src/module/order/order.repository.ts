import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { Order } from '@prisma/client';

@Injectable()
export class OrderRepository {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Подсчёт числа заказов за "сегодня" по множеству аккаунтов одним groupBy.
     * "Сегодня" считаем по UTC-границам. При необходимости можно заменить на TZ.
     */
    async countTodayByAccountIds(accountIds: string[]): Promise<Record<string, number>> {
        if (!accountIds?.length) return {};

        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);

        const end = new Date();
        end.setUTCHours(23, 59, 59, 999);

        const rows = await this.prisma.order.groupBy({
            by: ['accountId'],
            where: {
                accountId: { in: accountIds },
                date: { gte: start, lt: end },
            },
            _count: { _all: true },
        });

        const map: Record<string, number> = {};
        for (const r of rows) {
            map[r.accountId] = r._count._all;
        }
        return map;
    }

    async addOrderNumber(accountId: string, orderNumber: string, date: Date): Promise<Order> {
        return this.prisma.order.upsert({
            where: { orderNumber },
            create: {
                orderNumber,
                accountId,
                date,
            },
            update: {
                date,
            },
        });
    }

    async getOrder(orderNumber: string): Promise<Order | null> {
        return this.prisma.order.findFirst({
            where: { orderNumber },
        });
    }
}
