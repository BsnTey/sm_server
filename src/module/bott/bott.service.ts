import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../http/http.service';
import { BotTHeadersService } from './entities/headers-bot-t.entity';
import { HtmlWCsrfToken, ISearchByTelegramId } from './interfaces/bot-t.interface';
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
        private configService: ConfigService,
        private httpService: HttpService,
        private botTHeaders: BotTHeadersService,
    ) {}

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
