import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { PaymentOrder, PaymentOrderStatusHistory, Prisma, StatusPayment } from '@prisma/client';
import { FilterStatusPayment, Pagination } from './dto/queryFilter.dto';

type StatsRow = {
    bucket: Date;
    count: number;
    sum_amount: number;
};

@Injectable()
export class PaymentRepository {
    constructor(private prisma: PrismaService) {}

    private statusSQL(status?: StatusPayment) {
        if (status) return Prisma.sql`AND p.status::text = ${status}`;
        return Prisma.sql`AND p.status::text IN (${Prisma.join([StatusPayment.Transfered, StatusPayment.Completed])})`;
    }

    async createPaymentOrder(data: { amount: number; amountCredited: number; userTelegramId: string }): Promise<PaymentOrder> {
        return this.prisma.paymentOrder.create({
            data: {
                amount: data.amount,
                amountCredited: data.amountCredited,
                userTelegramId: data.userTelegramId,
            },
        });
    }

    async getPaymentOrderById(id: string): Promise<PaymentOrder | null> {
        return this.prisma.paymentOrder.findUnique({
            where: { id },
        });
    }

    async updatePaymentOrderStatus(id: string, status: StatusPayment): Promise<PaymentOrder | null> {
        return this.prisma.paymentOrder.update({
            where: { id },
            data: { status },
        });
    }

    async getPaymentOrdersByUserTelegramId(userTelegramId: string): Promise<PaymentOrder[]> {
        return this.prisma.paymentOrder.findMany({
            where: { userTelegramId },
        });
    }

    async completeTransferedPaymentOrder(id: string, receiptUrl: string): Promise<PaymentOrder> {
        return this.prisma.paymentOrder.update({
            where: { id },
            data: {
                status: StatusPayment.Transfered,
                receiptUrl,
            },
        });
    }

    async updatePaymentOrderInformation(id: string, transactionId: number, isPositive: boolean, completedAt: Date): Promise<PaymentOrder> {
        return this.prisma.paymentOrder.update({
            where: { id },
            data: {
                transactionId,
                isPositive,
                completedAt,
            },
        });
    }

    async createPaymentOrderStatusHistory(id: string, status: StatusPayment): Promise<PaymentOrderStatusHistory> {
        return this.prisma.paymentOrderStatusHistory.create({
            data: {
                paymentOrderId: id,
                status,
            },
        });
    }

    async getPaymentOrders(
        pagination: Pagination,
        filters: FilterStatusPayment,
    ): Promise<{
        data: any[];
        meta: { total: number; page: number; limit: number; pages: number };
        sumAmount: number;
    }> {
        const page = Math.max(1, pagination?.page ?? 1);
        const limit = Math.min(200, Math.max(1, pagination?.limit ?? 50));
        const skip = (page - 1) * limit;

        const where: Prisma.PaymentOrderWhereInput = {};
        if (filters?.status) where.status = filters.status;

        const [total, sumAgg, rows] = await this.prisma.$transaction([
            this.prisma.paymentOrder.count({ where }),
            this.prisma.paymentOrder.aggregate({
                where,
                _sum: { amount: true },
            }),
            this.prisma.paymentOrder.findMany({
                where,
                include: {
                    userTelegram: { select: { telegramName: true } },
                    statusHistory: {
                        select: { status: true, changedAt: true },
                        orderBy: { changedAt: 'asc' },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
        ]);

        return {
            data: rows,
            meta: {
                total,
                page,
                limit,
                pages: Math.max(1, Math.ceil(total / limit)),
            },
            sumAmount: sumAgg._sum.amount ?? 0,
        };
    }

    async applyCouponToPaymentOrder(paymentId: string, newAmountCredited: number, couponId: string): Promise<PaymentOrder> {
        return this.prisma.paymentOrder.update({
            where: { id: paymentId },
            data: {
                amountCredited: newAmountCredited,
                couponId: couponId,
                couponApplied: true,
                updatedAt: new Date(),
            },
        });
    }

    async getStatsDaily(from: Date, toInclusive: Date, status?: StatusPayment) {
        return this.prisma.$queryRaw<StatsRow[]>(Prisma.sql`
    WITH series AS (
      SELECT gs::date AS bucket
      FROM generate_series(
        date_trunc('day', ${from}::timestamp),
        date_trunc('day', ${toInclusive}::timestamp) - interval '1 day',
        interval '1 day'
      ) AS gs
    ),
    agg AS (
      SELECT date_trunc('day', p.completed_at)::date AS bucket,
             COUNT(*)::int                          AS count,
             COALESCE(SUM(p.amount), 0)             AS sum_amount
      FROM "payment_order" p
      WHERE p.completed_at IS NOT NULL
        AND p.completed_at >= ${from}
        AND p.completed_at <=  ${toInclusive}
        ${this.statusSQL(status)}
      GROUP BY 1
    )
    SELECT s.bucket, COALESCE(a.count, 0) AS count, COALESCE(a.sum_amount, 0) AS sum_amount
    FROM series s
    LEFT JOIN agg a ON a.bucket = s.bucket
    ORDER BY s.bucket ASC
  `);
    }

    private async getMonthlyBounds(status?: StatusPayment) {
        const [row] = await this.prisma.$queryRaw<
            Array<{
                min_bucket: Date | null;
                max_bucket: Date | null;
            }>
        >(Prisma.sql`
      SELECT date_trunc('month', MIN(p.completed_at)) AS min_bucket,
             date_trunc('month', MAX(p.completed_at)) AS max_bucket
      FROM "payment_order" p
      WHERE p.completed_at IS NOT NULL
        ${this.statusSQL(status)}
    `);

        const now = new Date();
        if (!row?.min_bucket || !row?.max_bucket) {
            const from = new Date(now);
            from.setMonth(now.getMonth() - 11, 1);
            from.setHours(0, 0, 0, 0);

            const to = new Date(now);
            to.setMonth(now.getMonth() + 1, 1);
            to.setHours(0, 0, 0, 0);

            return { from, to };
        }

        const from = new Date(row.min_bucket);
        const to = new Date(row.max_bucket);
        to.setMonth(to.getMonth() + 1, 1); // правая граница — начало след. месяца
        return { from, to };
    }

    async getStatsMonthly(fromMonthStart: Date, toMonthStartNext: Date, status?: StatusPayment) {
        return this.prisma.$queryRaw<StatsRow[]>(Prisma.sql`
    WITH series AS (
      SELECT date_trunc('month', gs)::date AS bucket
      FROM generate_series(
        date_trunc('month', ${fromMonthStart}::timestamp),
        date_trunc('month', ${toMonthStartNext}::timestamp) - interval '1 month',
        interval '1 month'
      ) AS gs
    ),
    agg AS (
      SELECT date_trunc('month', p.completed_at)::date AS bucket,
             COUNT(*)::int                            AS count,
             COALESCE(SUM(p.amount), 0)               AS sum_amount
      FROM "payment_order" p
      WHERE p.completed_at IS NOT NULL
        AND p.completed_at >= ${fromMonthStart}
        AND p.completed_at <  ${toMonthStartNext}
        ${this.statusSQL(status)}
      GROUP BY 1
    )
    SELECT s.bucket, COALESCE(a.count, 0) AS count, COALESCE(a.sum_amount, 0) AS sum_amount
    FROM series s
    LEFT JOIN agg a ON a.bucket = s.bucket
    ORDER BY s.bucket ASC
  `);
    }

    async getStatsTotals(from: Date, toInclusive: Date, status?: StatusPayment) {
        const [row] = await this.prisma.$queryRaw<Array<{ count: number; sum_amount: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count, COALESCE(SUM(p.amount), 0) AS sum_amount
    FROM "payment_order" p
    WHERE p.completed_at IS NOT NULL
      AND p.completed_at >= ${from}
      AND p.completed_at <=  ${toInclusive}
      ${this.statusSQL(status)}
  `);
        return row ?? { count: 0, sum_amount: 0 };
    }
}
