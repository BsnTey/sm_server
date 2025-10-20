import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentOrderEntity } from './entities/payment.entities';
import { PaymentOrder as PaymentOrderModel } from '.prisma/client';
import { StatusPayment } from '@prisma/client';
import { PaymentRepository } from './payment.repository';
import { BottService } from '../bott/bott.service';
import {
    ERROR_CHANGE_BALANCE,
    ERROR_GET_TRANSACTIONS,
    ERROR_NOT_FOUND_TRANSACTION,
    ERROR_USER_SEARCH_PAGE,
} from './constants/error.constants';
import { extractBalance, extractUserBotId, extractUsersStatistics, getPromoCodeDetailsFromHtml } from '../telegram/utils/payment.utils';
import { IReplenishmentUsersBotT } from '../bott/interfaces/replenishment-bot-t.interface';
import { UserStatistic } from './interfaces/statistic.interface';
import { ConfigService } from '@nestjs/config';
import { Payment } from './interfaces/payment.interface';
import { FilterStatusPayment, Pagination } from './dto/queryFilter.dto';

@Injectable()
export class PaymentService {
    private tgNamesExceptionStatistic: string[] = this.configService.getOrThrow('TELEGRAM_NAMES_EXCEPTION_STATISTIC').split(',');
    private domain: string = this.configService.getOrThrow('DOMAIN');

    constructor(
        private paymentRepository: PaymentRepository,
        private bottService: BottService,
        private configService: ConfigService,
    ) {}

    async getUserByTelegramId(telegramId: string) {
        // let searchId;
        // try {
        //     const response = await this.bottService.searchSearchIdByTelegramId(telegramId);
        //     searchId = response.results[0].id;
        // } catch (err) {
        //     // throw new NotFoundException(ERROR_GET_SEARCH_ID);
        // }
        let response;
        try {
            response = await this.bottService.pageSearchUserByTelegramId(telegramId);
        } catch (err) {
            throw new NotFoundException(ERROR_USER_SEARCH_PAGE);
        }
        const balance = extractBalance(response);
        const userBotId = extractUserBotId(response);
        return {
            balance,
            userBotId,
        };
    }

    async userBalanceEdit(userBotId: string, amount: string, isPositive: boolean) {
        try {
            await this.bottService.userBalanceEdit(userBotId, amount, isPositive);
        } catch (err) {
            throw new BadRequestException(ERROR_CHANGE_BALANCE);
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

    async makeDepositUserBalance(paymentId: string, receiptUrl: string): Promise<PaymentOrderEntity> {
        const entityTrans = await this.completeTransferedPaymentOrder(paymentId, receiptUrl);
        const telegramId = entityTrans.userTelegramId;

        const user = await this.getUserByTelegramId(telegramId);
        await this.userBalanceEdit(user.userBotId, String(entityTrans.amountCredited), true);

        return this.updatePaymentAfterTransaction(paymentId, +telegramId, entityTrans.amountCredited, true);
    }

    private async updatePaymentAfterTransaction(paymentId: string, telegramId: number, amount: number, isPositive: boolean) {
        try {
            const response = await this.bottService.getReplenishment();
            const { transactionId, completedAt } = this.getDataFromReplenishment(response, telegramId, amount);

            const unixtimeMsc = completedAt * 1000;
            const formDate = new Date(unixtimeMsc);

            const paymentOrderModel: PaymentOrderModel = await this.paymentRepository.updatePaymentOrderInformation(
                paymentId,
                transactionId,
                isPositive,
                formDate,
            );
            return new PaymentOrderEntity(paymentOrderModel);
        } catch (err) {
            throw new BadRequestException(ERROR_GET_TRANSACTIONS);
        }
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

    startOfDay(d: Date) {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
    }
    addDays(d: Date, n: number) {
        const x = new Date(d);
        x.setDate(x.getDate() + n);
        return x;
    }
    startOfMonth(d: Date) {
        const x = new Date(d);
        x.setDate(1);
        x.setHours(0, 0, 0, 0);
        return x;
    }
    addMonths(d: Date, n: number) {
        const x = new Date(d);
        x.setMonth(x.getMonth() + n, 1);
        return this.startOfMonth(x);
    }
    toISODate(d: Date) {
        return d.toISOString().slice(0, 10);
    }

    async getPaymentStats(params: { dayFrom?: Date; dayTo?: Date; monthFrom?: Date; monthTo?: Date; status?: StatusPayment }) {
        const now = new Date();

        // ---- ДНИ: дефолт последние 7 дат, включая сегодня ----
        const df = this.startOfDay(params.dayFrom ?? this.addDays(now, -6));
        const dt = this.addDays(new Date(params.dayTo ?? now), 1);

        // ---- МЕСЯЦЫ: дефолт последние 12 месяцев, включая текущий ----
        const thisMonth = this.startOfMonth(now);
        const mf = this.startOfMonth(params.monthFrom ?? this.addMonths(thisMonth, -11));
        const mt = this.startOfMonth(params.monthTo ?? thisMonth);
        const mToExclusive = this.addMonths(mt, 1);

        const [byDay, byMonth, totalsDay, totalsMonth] = await Promise.all([
            this.paymentRepository.getStatsDaily(df, dt, params.status),
            this.paymentRepository.getStatsMonthly(mf, mToExclusive, params.status),
            this.paymentRepository.getStatsTotals(df, dt, params.status),
            this.paymentRepository.getStatsTotals(mf, mToExclusive, params.status),
        ]);

        const byDayOut = byDay.map(r => ({
            date: this.toISODate(r.bucket),
            count: r.count,
            sumAmount: Number(r.sum_amount) || 0,
        }));

        const byMonthOut = byMonth.map(r => ({
            month: this.toISODate(r.bucket).slice(0, 7),
            count: r.count,
            sumAmount: Number(r.sum_amount) || 0,
        }));

        return {
            range: {
                day: { from: this.toISODate(df), to: this.toISODate(dt) },
                month: { from: this.toISODate(mf), to: this.toISODate(mt) },
            },
            byDay: byDayOut,
            byMonth: byMonthOut,
            totalsDay: { count: totalsDay.count, sumAmount: Number(totalsDay.sum_amount) || 0 },
            totalsMonth: { count: totalsMonth.count, sumAmount: Number(totalsMonth.sum_amount) || 0 },
        };
    }
}
