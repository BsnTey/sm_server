import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../http/http.service';
import { BotTHeadersService } from './entities/headers-bot-t.entity';
import { Html, ISearchByTelegramId } from './interfaces/bot-t.interface';
import { IReplenishmentUsersBotT } from './interfaces/replenishment-bot-t.interface';
import qs from 'qs';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { ProxyService } from '../proxy/proxy.service';
import { ProxyEntity } from '../proxy/entities/proxy.entity';
import { ERROR_GET_STATISTICS } from '../payment/constants/error.constants';
import dayjs from 'dayjs';

@Injectable()
export class BottService {
    private urlBotT: string = this.configService.getOrThrow('HOST_BOTT_W_PROTOCOL');
    private apiUrlBotT: string = this.configService.getOrThrow('API_BOTT_W_PROTOCOL');
    private sellerTradeBotId: string = this.configService.getOrThrow('SELLER_TRADE_BOT_ID');
    private sellerTradeBotToken: string = this.configService.getOrThrow('SELLER_TRADE_TOKEN');
    private headers = this.botTHeaders.headers;
    private httpsAgent: SocksProxyAgent;

    constructor(
        private configService: ConfigService,
        private httpService: HttpService,
        private proxyService: ProxyService,
        private botTHeaders: BotTHeadersService,
    ) {
        this.getRandomProxy().then(proxyEntity => {
            this.httpsAgent = new SocksProxyAgent(proxyEntity.proxy);
        });
    }

    private async getRandomProxy(): Promise<ProxyEntity> {
        return await this.proxyService.getRandomProxy();
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

        const response = await this.httpService.get<ISearchByTelegramId>(url, { params, httpsAgent: this.httpsAgent });
        return response.data;
    }

    async getUserBotId(searchId: string): Promise<string> {
        const params = {
            bot_id: this.sellerTradeBotId,
            'BotUserSearch[user_id]': searchId,
        };
        const url = this.urlBotT + `lk/common/users/users/index`;
        const response = await this.httpService.get(url, { headers: this.headers, params, httpsAgent: this.httpsAgent });
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
        const response = await this.httpService.post(url, payload, { headers: this.headers, params, httpsAgent: this.httpsAgent });
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
        const response = await this.httpService.post(url, payload, { params, httpsAgent: this.httpsAgent });
        return response.data;
    }

    async getStatistics(): Promise<Html> {
        const params = {
            bot_id: this.sellerTradeBotId,
        };

        const url = this.urlBotT + `lk/common/replenishment/main/statistics`;
        try {
            const response = await this.httpService.get(url, { headers: this.headers, params, httpsAgent: this.httpsAgent });
            return response.data;
        } catch (err) {
            throw new BadRequestException(ERROR_GET_STATISTICS);
        }
    }

    async getCouponPage(page = 1): Promise<Html> {
        const params = {
            bot_id: this.sellerTradeBotId,
            page,
        };

        const url = this.urlBotT + `lk/common/shop/coupon/index`;
        const response = await this.httpService.get(url, { headers: this.headers, params, httpsAgent: this.httpsAgent });
        return response.data;
    }

    async createPromocode(csrfToken: string, promoName: string, discountPercent: number, countActivation = 5, activateAt?: string) {
        const params = {
            bot_id: this.sellerTradeBotId,
            type: '0',
        };

        if (!activateAt) {
            activateAt = dayjs().add(1, 'month').format('YYYY-MM-DDTHH:mm');
        }

        const payload = qs.stringify({
            '_csrf-frontend': csrfToken,
            'ShopCouponCreateForm[code]': promoName,
            'ShopCouponCreateForm[count]': countActivation,
            'ShopCouponCreateForm[min_price]': 50,
            'ShopCouponCreateForm[only_first]': 0,
            'ShopCouponCreateForm[only_one_user_one_coupon]': 0,
            'ShopCouponCreateForm[activate_at]': activateAt,
            'ShopCouponCreateForm[discount]': discountPercent,
        });

        const url = this.urlBotT + `lk/common/shop/coupon/create`;
        const response = await this.httpService.post(url, payload, { headers: this.headers, params, httpsAgent: this.httpsAgent });
        return response.status;
    }

    async createReplenishPromocode(csrfToken: string, promoName: string, discount: number, countActivation = 1, activateAt?: string) {
        const params = {
            bot_id: this.sellerTradeBotId,
            type: '2',
        };

        if (!activateAt) {
            activateAt = dayjs().add(1, 'month').format('YYYY-MM-DDTHH:mm');
        }

        const payload = qs.stringify({
            '_csrf-frontend': csrfToken,
            'ShopCouponReplenishmentCreate[code]': promoName,
            'ShopCouponReplenishmentCreate[discount]': discount,
            'ShopCouponReplenishmentCreate[count]': countActivation,
            'ShopCouponReplenishmentCreate[only_one_user_one_coupon]': 0,
            'ShopCouponReplenishmentCreate[activate_at]': activateAt,
        });

        const url = this.urlBotT + `lk/common/shop/coupon/replenish`;
        const response = await this.httpService.post(url, payload, { headers: this.headers, params, httpsAgent: this.httpsAgent });
        return response.status;
    }
}
