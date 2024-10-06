import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BottRepository } from './bott.repository';
import { PaymentOrder as PaymentOrderModel, StatusPayment } from '@prisma/client';
import { PaymentOrderEntity } from './entities/payment.entities';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../http/http.service';
import { BotTHeadersService } from './entities/headers-bot-t.entity';
import { HtmlWCsrfToken, ISearchByTelegramId } from './interfaces/bot-t.interface';
import { extractCsrf, extractUserBotId } from '../telegram/utils/payment.utils';
import {
    ERROR_CHANGE_BALANCE,
    ERROR_GET_BOT_ID,
    ERROR_GET_SEARCH_ID,
    ERROR_GET_TOKEN,
    ERROR_GET_TRANSACTIONS,
    ERROR_NOT_FOUND_TRANSACTION,
} from './constants/error.constants';
import { IReplenishmentUsersBotT } from './interfaces/replenishment-bot-t.interface';
import qs from 'qs';

@Injectable()
export class BottService {
    private urlBotT: string = this.configService.getOrThrow('HOST_BOTT_W_PROTOCOL');
    private apiUrlBotT: string = this.configService.getOrThrow('API_BOTT_W_PROTOCOL');
    private sellerTradeBotId: string = this.configService.getOrThrow('SELLER_TRADE_BOT_ID');
    private sellerTradeBotToken: string = this.configService.getOrThrow('SELLER_TRADE_TOKEN');
    private headers = this.botTHeaders.headers;

    constructor(
        private paymentRepository: BottRepository,
        private configService: ConfigService,
        private httpService: HttpService,
        private botTHeaders: BotTHeadersService,
    ) {}

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

    async getAllPaymentOrders(): Promise<any> {
        const paymentOrderModel = await this.paymentRepository.getAllPaymentOrders();
        console.log(paymentOrderModel);
        return paymentOrderModel;
    }

    async updatePaymentOrderStatus(id: string, status: StatusPayment): Promise<PaymentOrderEntity> {
        const paymentOrderModel: PaymentOrderModel = await this.paymentRepository.updatePaymentOrderStatus(id, status);
        await this.paymentRepository.createPaymentOrderStatusHistory(paymentOrderModel.id, paymentOrderModel.status);
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

    private async changeUserBalance(id: string, telegramId: string, amount: number, isPositive: boolean = true) {
        let searchId;
        try {
            const response = await this.searchSearchIdByTelegramId(telegramId);
            searchId = response.results[0].id;
        } catch (err) {
            throw new NotFoundException(ERROR_GET_SEARCH_ID);
        }
        let userBotId;
        try {
            const response = await this.getUserBotId(searchId);
            userBotId = extractUserBotId(response);
        } catch (err) {
            throw new NotFoundException(ERROR_GET_BOT_ID);
        }
        let csrfToken;
        try {
            const htmlWCsrfToken = await this.getUserBalanceEdit(userBotId);
            csrfToken = extractCsrf(htmlWCsrfToken);
        } catch (err) {
            throw new BadRequestException(ERROR_GET_TOKEN);
        }
        try {
            await this.userBalanceEdit(userBotId, csrfToken, String(amount), isPositive);
        } catch (err) {
            throw new BadRequestException(ERROR_CHANGE_BALANCE);
        }
        try {
            const response = await this.getReplenishment();
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

    private getDataFromReplenishment(data: IReplenishmentUsersBotT, telegramId: number, amount: number) {
        const transaction = data.data.find(transact => transact.user.telegram_id === telegramId && transact.amount / 100 == amount);
        if (!transaction) throw new NotFoundException(ERROR_NOT_FOUND_TRANSACTION);

        return {
            transactionId: transaction.id,
            completedAt: transaction.created_at,
        };
    }

    async searchSearchIdByTelegramId(telegramId: string): Promise<ISearchByTelegramId> {
        const params = {
            bot_id: this.sellerTradeBotId,
            token: this.sellerTradeBotToken,
            is_hide: '1',
            term: telegramId,
            _type: 'query',
            q: telegramId,
        };

        const url = `${this.apiUrlBotT}v2/ajax/bot/user/name`;

        const response = await this.httpService.get<ISearchByTelegramId>(url, { params });
        return response.data;
    }

    async getUserBotId(searchId: string): Promise<string> {
        const params = {
            bot_id: this.sellerTradeBotId,
            'BotUserSearch[user_id]': searchId,
        };
        const url = this.urlBotT + `lk/common/users/users/index`;
        const response = await this.httpService.get(url, { headers: this.headers, params });
        return response.data;
    }

    async getUserBalanceEdit(userBotId: string): Promise<HtmlWCsrfToken> {
        const params = {
            id: userBotId,
            bot_id: this.sellerTradeBotId,
        };

        const url = this.urlBotT + `lk/common/users/user/balance-edit`;
        const response = await this.httpService.get(url, { headers: this.headers, params });
        return response.data;
    }

    async userBalanceEdit(userBotId: string, csrfToken: string, amount: string, isPositive: boolean): Promise<string> {
        const params = {
            id: userBotId,
            bot_id: this.sellerTradeBotId,
        };
        const payload = qs.stringify({
            '_csrf-frontend': csrfToken,
            'UserEditBalanceForm[balance]': amount,
            'UserEditBalanceForm[is_positive]': +isPositive,
        });

        const url = this.urlBotT + `lk/common/users/user/balance-edit`;
        const response = await this.httpService.post(url, payload, { headers: this.headers, params });
        return response.data;
    }

    async getReplenishment(isPositive: boolean | null = null): Promise<IReplenishmentUsersBotT> {
        const params = {
            token: this.sellerTradeBotToken,
        };

        const payload = {
            bot_id: this.sellerTradeBotId,
            user_id: null,
            is_positive: isPositive,
        };

        const url = this.apiUrlBotT + `v1/bot/replenishment/user/index`;
        const response = await this.httpService.post(url, payload, { params });
        return response.data;
    }
}
