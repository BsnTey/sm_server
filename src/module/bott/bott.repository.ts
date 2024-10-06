import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { PaymentOrder, PaymentOrderStatusHistory, StatusPayment } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BottRepository {
    private domain: string = this.configService.getOrThrow('DOMAIN');

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) {}

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

    async updatePaymentOrderStatus(id: string, status: StatusPayment): Promise<PaymentOrder> {
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

    async getAllPaymentOrders() {
        const paymentOrders = await this.prisma.paymentOrder.findMany({
            include: {
                userTelegram: {
                    select: {
                        telegramName: true,
                    },
                },
                statusHistory: {
                    select: {
                        status: true,
                        changedAt: true,
                    },
                    orderBy: {
                        changedAt: 'asc',
                    },
                },
            },
        });

        return paymentOrders.map(order => ({
            id: order.id,
            transactionId: order.transactionId,
            userTelegramName: order.userTelegram.telegramName,
            amount: order.amount,
            amountCredited: order.amountCredited,
            status: order.status,
            receiptUrl: `${this.domain}/receipts/${order.receiptUrl}`,
            statusHistory: order.statusHistory.map(history => ({
                status: history.status,
                date: history.changedAt.toISOString().replace('T', ' ').substring(0, 16),
            })),
        }));
    }
}
