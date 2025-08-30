import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentOrderEntity } from './entities/payment.entities';
import { PaymentOrder as PaymentOrderModel } from '.prisma/client';
import { StatusPayment } from '@prisma/client';
import { PaymentRepository } from './payment.repository';
import { BottService } from '../bott/bott.service';
import {
    ERROR_CHANGE_BALANCE,
    ERROR_GET_BOT_ID,
    ERROR_GET_SEARCH_ID,
    ERROR_GET_TRANSACTIONS,
    ERROR_NOT_FOUND_TRANSACTION,
} from './constants/error.constants';
import { extractCsrf, extractUserBotId, extractUsersStatistics, getPromoCodeDetailsFromHtml } from '../telegram/utils/payment.utils';
import { IReplenishmentUsersBotT } from '../bott/interfaces/replenishment-bot-t.interface';
import { UserStatistic } from './interfaces/statistic.interface';
import { ConfigService } from '@nestjs/config';
import { Payment } from './interfaces/payment.interface';
import { FilterStatusPayment, Pagination } from './dto/queryFilter.dto';

@Injectable()
export class PaymentService {
    private tgNamesExceptionStatistic: string[] = this.configService.getOrThrow('TELEGRAM_NAMES_EXCEPTION_STATISTIC').split(',');
    private tgIdVipCoef: string[] = this.configService.getOrThrow('TELEGRAM_ID_VIP_COEF').split(',');
    private domain: string = this.configService.getOrThrow('DOMAIN');

    constructor(
        private paymentRepository: PaymentRepository,
        private bottService: BottService,
        private configService: ConfigService,
    ) {}

    async changeUserBalance(id: string, telegramId: string, amount: number, isPositive: boolean = true) {
        let searchId;
        let csrfToken;
        try {
            const response = await this.bottService.searchSearchIdByTelegramId(telegramId);
            searchId = response.results[0].id;
        } catch (err) {
            throw new NotFoundException(ERROR_GET_SEARCH_ID);
        }
        let userBotId;
        try {
            const response = await this.bottService.getUserBotId(searchId);
            userBotId = extractUserBotId(response);
            csrfToken = extractCsrf(response);
        } catch (err) {
            throw new NotFoundException(ERROR_GET_BOT_ID);
        }

        try {
            await this.bottService.userBalanceEdit(userBotId, csrfToken, String(amount), isPositive);
        } catch (err) {
            throw new BadRequestException(ERROR_CHANGE_BALANCE);
        }
        try {
            const response = await this.bottService.getReplenishment();
            const { transactionId, completedAt } = this.getDataFromReplenishment(response, +telegramId, +amount);

            const unixtimeMsc = completedAt * 1000;
            const formDate = new Date(unixtimeMsc);

            const paymentOrderModel: PaymentOrderModel = await this.paymentRepository.updatePaymentOrderInformation(
                id,
                transactionId,
                isPositive,
                formDate,
            );
            return new PaymentOrderEntity(paymentOrderModel);
        } catch (err) {
            throw new BadRequestException(ERROR_GET_TRANSACTIONS);
        }
    }

    async createPaymentOrder(amount: number, userTelegramId: string): Promise<PaymentOrderEntity> {
        const amountCredited = this.calculateAmountWithBonus(amount, userTelegramId);

        const paymentOrderModel: PaymentOrderModel = await this.paymentRepository.createPaymentOrder({
            amount,
            amountCredited,
            userTelegramId,
        });
        await this.paymentRepository.createPaymentOrderStatusHistory(paymentOrderModel.id, paymentOrderModel.status);
        return new PaymentOrderEntity(paymentOrderModel);
    }

    private calculateAmountWithBonus(amount: number, userTelegramId: string): number {
        switch (true) {
            // case this.tgIdVipCoef.includes(userTelegramId):
            //     return Math.floor(amount * 1.25);
            case amount >= 5000:
                return Math.floor(amount * 1.05);
            case amount >= 2000:
                return Math.floor(amount * 1.02);
            default:
                return amount;
        }
    }

    async getPaymentOrder(id: string): Promise<PaymentOrderEntity | null> {
        const paymentOrderModel: PaymentOrderModel | null = await this.paymentRepository.getPaymentOrderById(id);
        return paymentOrderModel ? new PaymentOrderEntity(paymentOrderModel) : null;
    }

    async getPaymentOrders(
        pagination: Pagination,
        filters: FilterStatusPayment,
    ): Promise<{
        data: Payment[];
        meta: { total: number; page: number; limit: number; pages: number };
        sumAmount: number;
    }> {
        const res = await this.paymentRepository.getPaymentOrders(pagination, filters);

        const data: Payment[] = res.data.map(order => ({
            id: order.id,
            transactionId: order.transactionId ?? null,
            userTelegramName: order.userTelegram?.telegramName ?? null,
            completedAt: order.completedAt ?? null,
            amount: order.amount,
            amountCredited: order.amountCredited,
            status: order.status,
            receiptUrl: order.receiptUrl ? `${this.domain}/receipts/${order.receiptUrl}` : null,
            statusHistory: order.statusHistory.map((h: { status: any; changedAt: { toISOString: () => any } }) => ({
                status: h.status,
                date: h.changedAt.toISOString(),
            })),
        }));

        return {
            data,
            meta: res.meta,
            sumAmount: res.sumAmount,
        };
    }

    async updatePaymentOrderStatus(id: string, status: StatusPayment): Promise<PaymentOrderEntity> {
        const paymentOrderModel = await this.paymentRepository.updatePaymentOrderStatus(id, status);
        if (!paymentOrderModel) throw new NotFoundException(ERROR_NOT_FOUND_TRANSACTION);
        await this.paymentRepository.createPaymentOrderStatusHistory(id, status);
        return new PaymentOrderEntity(paymentOrderModel);
    }

    async getUserPaymentOrders(userTelegramId: string): Promise<PaymentOrderEntity[]> {
        const paymentOrderModels: PaymentOrderModel[] = await this.paymentRepository.getPaymentOrdersByUserTelegramId(userTelegramId);
        if (!paymentOrderModels || paymentOrderModels.length === 0) {
            return [];
        }
        return paymentOrderModels.map(paymentOrderModel => new PaymentOrderEntity(paymentOrderModel));
    }

    async makeDepositUserBalance(id: string, receiptUrl: string): Promise<PaymentOrderEntity> {
        const entityTrans = await this.completeTransferedPaymentOrder(id, receiptUrl);
        return await this.changeUserBalance(id, entityTrans.userTelegramId, entityTrans.amountCredited);
    }

    private async completeTransferedPaymentOrder(id: string, receiptUrl: string): Promise<PaymentOrderEntity> {
        const paymentOrderModel: PaymentOrderModel = await this.paymentRepository.completeTransferedPaymentOrder(id, receiptUrl);
        await this.paymentRepository.createPaymentOrderStatusHistory(paymentOrderModel.id, paymentOrderModel.status);
        return new PaymentOrderEntity(paymentOrderModel);
    }

    private getDataFromReplenishment(data: IReplenishmentUsersBotT, telegramId: number, amount: number) {
        const transaction = data.data.find(transact => transact.user.telegram_id === telegramId && transact.amount / 100 == amount);
        if (!transaction) throw new NotFoundException(ERROR_NOT_FOUND_TRANSACTION);

        return {
            transactionId: transaction.id,
            completedAt: transaction.created_at,
        };
    }

    async findRemainingActivations(telegramId: string, userName: string) {
        let promoCodeDetails = null;

        for (let page = 1; page <= 5; page++) {
            const responseCouponsPage = await this.bottService.getCouponPage(page);

            promoCodeDetails = getPromoCodeDetailsFromHtml(responseCouponsPage, userName);
            if (promoCodeDetails) {
                return promoCodeDetails;
            }

            promoCodeDetails = getPromoCodeDetailsFromHtml(responseCouponsPage, telegramId);
            if (promoCodeDetails) {
                return promoCodeDetails;
            }
        }
        return null;
    }

    // async createPromocode(telegramId: string, userName: string) {
    //     const responseStatistics = await this.bottService.getStatistics();
    //     const csrfToken = extractCsrf(responseStatistics);
    //     const usersStatistic = extractUsersStatistics(responseStatistics, this.tgNamesExceptionStatistic);
    //     const promoName = userName || telegramId;
    //     const discountPercent = this.getDiscountFromStatistic(telegramId, userName, usersStatistic);
    //     const responseStatus = await this.bottService.createPromocode(csrfToken, promoName, discountPercent);
    //     if (responseStatus != 200) throw new BadRequestException(ERROR_CREATE_PROMOCODE);
    //     return { promoName, discountPercent };
    // }

    async getInfoAboutPromocode(telegramId: string, userName: string) {
        const responseStatistics = await this.bottService.getStatistics();
        const usersStatistic = extractUsersStatistics(responseStatistics, this.tgNamesExceptionStatistic);
        return this.getDiscountFromStatistic(telegramId, userName, usersStatistic);
    }

    private getDiscountFromStatistic(telegramId: string, userName: string, usersStatistic: UserStatistic[]) {
        const user = usersStatistic.find(user => telegramId === user.tgId || userName === user.name);
        if (!user) return 5;

        switch (true) {
            case user.row === 1:
                return 25;
            case [2, 3, 4, 5].includes(user.row):
                return 20;
            case [6, 7, 8, 9, 10].includes(user.row):
                return 15;
            case [11, 12, 13, 14, 15].includes(user.row):
                return 10;
            default:
                return 5;
        }
    }

    async applyCouponToPaymentOrder(paymentId: string, newAmountCredited: number, couponId: string): Promise<PaymentOrderEntity> {
        const paymentOrderModel = await this.paymentRepository.applyCouponToPaymentOrder(paymentId, newAmountCredited, couponId);
        return new PaymentOrderEntity(paymentOrderModel);
    }

    async getPaymentStats(params: { from?: Date; to?: Date; status?: StatusPayment }) {
        const [byDay, byMonth, totals] = await Promise.all([
            this.paymentRepository.getStatsDaily(params.from, params.to, params.status),
            this.paymentRepository.getStatsMonthly(params.from, params.to, params.status),
            this.paymentRepository.getStatsTotals(params.from, params.to, params.status),
        ]);

        const byDayOut = byDay.map(r => ({
            date: r.bucket.toISOString().slice(0, 10),
            count: r.count,
            sumAmount: Number(r.sum_amount) ?? 0,
        }));

        const byMonthOut = byMonth.map(r => ({
            month: r.bucket.toISOString().slice(0, 7),
            count: r.count,
            sumAmount: Number(r.sum_amount) ?? 0,
        }));

        return {
            byDay: byDayOut,
            byMonth: byMonthOut,
            totals: {
                count: totals.count,
                sumAmount: Number(totals.sum_amount) ?? 0,
            },
        };
    }
}
