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
    ERROR_GET_TOKEN,
    ERROR_GET_TRANSACTIONS,
    ERROR_NOT_FOUND_TRANSACTION,
} from './constants/error.constants';
import { extractCsrf, extractUserBotId } from '../telegram/utils/payment.utils';
import { IReplenishmentUsersBotT } from '../bott/interfaces/replenishment-bot-t.interface';

@Injectable()
export class PaymentService {
    constructor(
        private paymentRepository: PaymentRepository,
        private bottService: BottService,
    ) {}

    async changeUserBalance(id: string, telegramId: string, amount: number, isPositive: boolean = true) {
        let searchId;
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
        } catch (err) {
            throw new NotFoundException(ERROR_GET_BOT_ID);
        }
        let csrfToken;
        try {
            const htmlWCsrfToken = await this.bottService.getUserBalanceEdit(userBotId);
            csrfToken = extractCsrf(htmlWCsrfToken);
        } catch (err) {
            throw new BadRequestException(ERROR_GET_TOKEN);
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
        const amountCredited = this.calculateAmountWithBonus(amount);

        const paymentOrderModel: PaymentOrderModel = await this.paymentRepository.createPaymentOrder({
            amount,
            amountCredited,
            userTelegramId,
        });
        await this.paymentRepository.createPaymentOrderStatusHistory(paymentOrderModel.id, paymentOrderModel.status);
        return new PaymentOrderEntity(paymentOrderModel);
    }

    private calculateAmountWithBonus(amount: number): number {
        return amount < 2000 ? amount : Math.floor(amount * 1.1);
    }

    async getPaymentOrder(id: string): Promise<PaymentOrderEntity | null> {
        const paymentOrderModel: PaymentOrderModel | null = await this.paymentRepository.getPaymentOrderById(id);
        return paymentOrderModel ? new PaymentOrderEntity(paymentOrderModel) : null;
    }

    async getAllPaymentOrders() {
        return await this.paymentRepository.getAllPaymentOrders();
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
}
