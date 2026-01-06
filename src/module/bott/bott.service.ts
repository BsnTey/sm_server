import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../http/http.service';
import { BotTHeadersService } from './headers.service';
import { Html, ISearchByTelegramId } from './interfaces/bot-t.interface';
import { IReplenishmentUsersBotT } from './interfaces/replenishment-bot-t.interface';
import qs from 'qs';
import {
    ERROR_CHANGE_BALANCE,
    ERROR_GET_SEARCH_ID,
    ERROR_GET_STATISTICS,
    ERROR_USER_SEARCH_PAGE,
} from '../payment/constants/error.constants';
import dayjs from 'dayjs';
import sleep from 'sleep-promise';
import { WrapWithLoading } from './decorators/wrap-with-loading.decorator';

import { getCouponPageKey, getSearchIdKey, getStatisticsKey, getUserBotIdKey } from '../cache/cache.keys';
import { RedisCacheService } from '../cache/cache.service';
import { extractBalance, extractUserBotId } from '../telegram/utils/payment.utils';

interface CachedValue<T> {
    value: T;
}

const TTL = {
    DAY: 86_400,
    HOUR: 3_600,
    FIVE_MIN: 300,
};

@Injectable()
export class BottService {
    private readonly logger = new Logger(BottService.name);

    private readonly urlBotT: string;
    private readonly apiUrlBotT: string;
    private readonly sellerTradeBotId: string;
    private readonly sellerTradeBotToken: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
        private readonly botTHeaders: BotTHeadersService,
        private readonly cacheService: RedisCacheService,
    ) {
        this.urlBotT = this.configService.getOrThrow('HOST_BOTT_W_PROTOCOL');
        this.apiUrlBotT = this.configService.getOrThrow('API_BOTT_W_PROTOCOL');
        this.sellerTradeBotId = this.configService.getOrThrow('SELLER_TRADE_BOT_ID');
        this.sellerTradeBotToken = this.configService.getOrThrow('SELLER_TRADE_TOKEN');
    }

    private async wrapperFuncLoading<T>(funcToExecute: () => Promise<T>): Promise<T> {
        const MAX_RETRIES = 5;
        const RETRY_DELAY_MS = 1000;
        await this.botTHeaders.ensureTokenUpdated();
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (attempt > 1 || this.botTHeaders.getIsUpdating()) {
                    await this.botTHeaders.ensureTokenUpdated();
                }
                return funcToExecute();
            } catch (error: any) {
                const isTokenError = this.isCloudflareOrAuthError(error);
                if (isTokenError && attempt < MAX_RETRIES) {
                    this.logger.warn(`Попытка запроса с Bot-t: ${attempt} провалена. Обновляю токен.`);
                    try {
                        await this.botTHeaders.updateTokenClaudeFlare();
                    } catch (updateError: any) {
                        this.logger.error(`Ошибка обновления токена на попытке: ${attempt} : ${updateError.message}`);
                        throw new Error(`Critical: Ошибка при обновлении токена. Ошибка: ${updateError.message}`);
                    }
                    await sleep(RETRY_DELAY_MS * attempt);
                } else if (attempt < MAX_RETRIES) {
                    this.logger.warn(`Попытка ${attempt} провалена...`);
                    await sleep(RETRY_DELAY_MS * attempt);
                } else {
                    this.logger.error(`Все ${MAX_RETRIES} попытки провалены.`);
                    throw new Error(`Провалено максимально попыток ${MAX_RETRIES}: ${error.message}`);
                }
            }
        }
        throw new Error('Неизвестная ошибка в wrapperFuncLoading');
    }

    // Публичный метод получения ID (с кэшированием)
    async getUserBotId(telegramId: string): Promise<string> {
        const searchId = await this.getSearchIdOrThrow(telegramId);

        const userBotIdKey = getUserBotIdKey(telegramId);

        const userBotIdFromCash = await this.cacheService.get<{ value: string }>(userBotIdKey);
        if (userBotIdFromCash) return userBotIdFromCash.value;

        const response = await this.fetchUserPageOrThrow(searchId);
        const userBotId = extractUserBotId(response);

        await this.cacheService.set(userBotIdKey, { value: userBotId }, TTL.DAY);

        return userBotId;
    }

    // Публичный метод получения Баланса (всегда свежий запрос)
    async getUserBotBalance(telegramId: string): Promise<number> {
        const searchId = await this.getSearchIdOrThrow(telegramId);

        const response = await this.fetchUserPageOrThrow(searchId);

        return extractBalance(response);
    }

    /**
     * Поиск searchId по telegramId с обработкой ошибок
     */
    private async getSearchIdOrThrow(telegramId: string): Promise<string> {
        const searchIdKey = getSearchIdKey(telegramId);

        const searchIdFromCash = await this.cacheService.get<{ value: string }>(searchIdKey);
        if (searchIdFromCash) return searchIdFromCash.value;

        try {
            const response = await this.searchSearchIdByTelegramId(telegramId);
            const resultId = response.results[0].id;

            await this.cacheService.set(searchIdKey, { value: resultId }, TTL.DAY);
            return resultId;
        } catch (e: any) {
            this.logger.error(`Ошибка searchSearchIdByTelegramId для ${telegramId}`, e.message);
            throw new NotFoundException(ERROR_GET_SEARCH_ID);
        }
    }

    /**
     * Запрос "сырой" страницы/данных бота по searchId с обработкой ошибок
     */
    private async fetchUserPageOrThrow(searchId: string): Promise<any> {
        try {
            return this.getUserBotIdFromAPI(searchId);
        } catch (e: any) {
            this.logger.error(`Ошибка getUserBotIdFromAPI для ${searchId}`, e.message);
            throw new NotFoundException(ERROR_USER_SEARCH_PAGE);
        }
    }

    async userBalanceEdit(userBotId: string, amount: string, isPositive: boolean) {
        try {
            await this.userBalanceEditFromAPI(userBotId, String(amount), isPositive);
        } catch (e: any) {
            this.logger.error('Ошибка userBalanceEdit', e.message);
            throw new BadRequestException(ERROR_CHANGE_BALANCE);
        }
    }

    private isCloudflareOrAuthError(error: any): boolean {
        if (error.isAxiosError && error.response) {
            const status = error.response.status;
            return [401, 403].includes(status) || (status === 503 && error.response.data?.includes('Cloudflare'));
        }
        return !!(error.message?.includes('challenge') || error.message?.includes('captcha'));
    }

    private async searchSearchIdByTelegramId(telegramId: string): Promise<ISearchByTelegramId> {
        const headers = this.botTHeaders.getAjaxHeaders();
        const proxy = this.botTHeaders.getProxy();

        const params = {
            bot_id: this.sellerTradeBotId,
            token: this.sellerTradeBotToken,
            is_hide: '1',
            term: telegramId,
            _type: 'query',
            q: telegramId,
        };

        const url = `${this.apiUrlBotT}v2/ajax/bot/user/name`;
        const response = await this.httpService.get<ISearchByTelegramId>(url, { headers, params, proxy });

        if (response.status == 200) {
            return response.data;
        }
        throw new BadRequestException('Ошибка при поиске пользователя по Telegram ID');
    }

    @WrapWithLoading()
    async getUserBotIdFromAPI(searchId: string): Promise<string> {
        const headers = this.botTHeaders.getHeaders();
        const proxy = this.botTHeaders.getProxy();

        const params = {
            bot_id: this.sellerTradeBotId,
            'BotUserSearch[user_id]': searchId,
        };
        const url = this.urlBotT + `lk/common/users/users/index`;
        const response = await this.httpService.get(url, { headers, params, proxy });
        this.botTHeaders.updateFromResponse(response);

        return response.data;
    }

    @WrapWithLoading()
    async userBalanceEditFromAPI(userBotId: string, amount: string, isPositive: boolean): Promise<string> {
        const headers = this.botTHeaders.getHeaders();
        const params = { id: userBotId, bot_id: this.sellerTradeBotId };
        const proxy = this.botTHeaders.getProxy();

        const payload = qs.stringify({
            '_csrf-frontend': this.botTHeaders.getCSRFToken(),
            'UserEditBalanceForm[balance]': amount,
            'UserEditBalanceForm[is_positive]': +isPositive,
        });

        const url = this.urlBotT + `lk/common/users/user/balance-edit`;

        let response;
        try {
            response = await this.httpService.post(url, payload, {
                headers: {
                    ...headers,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                params,
                proxy,
            });
        } catch (e: any) {
            if (e?.response?.status !== 302) {
                throw Error('Ошибка при изменении баланса пользователя');
            }
            response = e.response;
        }
        this.botTHeaders.updateFromResponse(response);

        await this.cacheService.del(getStatisticsKey());
        return response.data;
    }

    async getReplenishment(isPositive: boolean | null = null): Promise<IReplenishmentUsersBotT> {
        const params = { token: this.sellerTradeBotToken };
        const payload = {
            bot_id: this.sellerTradeBotId,
            user_id: null,
            is_positive: isPositive,
        };

        const headers = this.botTHeaders.getHeaders();
        const proxy = this.botTHeaders.getProxy();

        const url = this.apiUrlBotT + `v1/bot/replenishment/user/index`;
        const response = await this.httpService.post(url, payload, { headers, params, proxy });
        return response.data;
    }

    @WrapWithLoading()
    async getStatistics(): Promise<Html> {
        const key = getStatisticsKey();
        const cached = await this.cacheService.get<CachedValue<Html>>(key);
        if (cached) {
            //нужно, чтоб подтянулся csrf в хедеры
            this.botTHeaders.updateFromResponse(cached.value);
            return cached.value;
        }

        const params = { bot_id: this.sellerTradeBotId };
        const url = this.urlBotT + `lk/common/replenishment/main/statistics`;
        const headers = this.botTHeaders.getHeaders();
        const proxy = this.botTHeaders.getProxy();

        try {
            const response = await this.httpService.get(url, { headers, params, proxy });
            this.botTHeaders.updateFromResponse(response);

            await this.cacheService.set(key, { value: response.data }, TTL.HOUR);
            return response.data;
        } catch {
            throw new BadRequestException(ERROR_GET_STATISTICS);
        }
    }

    @WrapWithLoading()
    async getCouponPage(page = 1): Promise<Html> {
        const key = getCouponPageKey(page);
        // Html оборачиваем в объект
        const cached = await this.cacheService.get<CachedValue<Html>>(key);
        if (cached) {
            this.logger.log(`Отдал данные по ключу ${key}`);
            return cached.value;
        }

        const headers = this.botTHeaders.getHeaders();
        const proxy = this.botTHeaders.getProxy();
        const params = { bot_id: this.sellerTradeBotId, page };
        const url = this.urlBotT + `lk/common/shop/coupon/index`;

        const response = await this.httpService.get(url, { headers, params, proxy });
        this.botTHeaders.updateFromResponse(response);

        await this.cacheService.set(key, { value: response.data }, TTL.FIVE_MIN);
        this.logger.log(`Сохранил данные по ключу ${key}`);

        return response.data;
    }

    @WrapWithLoading()
    async createPromocode(promoName: string, discountPercent: number, countActivation = 5, activateAt?: string) {
        const headers = this.botTHeaders.getHeaders();
        const proxy = this.botTHeaders.getProxy();

        const params = { bot_id: this.sellerTradeBotId, type: '0' };

        if (!activateAt) {
            activateAt = dayjs().add(1, 'month').format('YYYY-MM-DDTHH:mm');
        }

        const csrf = this.botTHeaders.getCSRFToken();

        const payload = qs.stringify({
            '_csrf-frontend': csrf,
            'ShopCouponCreateForm[code]': promoName,
            'ShopCouponCreateForm[count]': countActivation,
            'ShopCouponCreateForm[min_price]': 50,
            'ShopCouponCreateForm[only_first]': 0,
            'ShopCouponCreateForm[only_one_user_one_coupon]': 0,
            'ShopCouponCreateForm[activate_at]': activateAt,
            'ShopCouponCreateForm[discount]': discountPercent,
        });

        const url = this.urlBotT + `lk/common/shop/coupon/create`;
        let response;
        try {
            response = await this.httpService.post(url, payload, {
                headers: {
                    ...headers,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                params,
                proxy,
            });
        } catch (e: any) {
            if (e?.response?.status !== 302) {
                throw Error('Ошибка при создании промокода на скидку');
            }
            response = e.response;
        }
        this.botTHeaders.updateFromResponse(response);

        if (response.status === 200 || response.status === 201 || response.status === 302) {
            this.logger.log(`Удалил данные промокодов на страницах`);
            await Promise.all(
                Array.from({ length: 9 }, (_, index) => {
                    return this.cacheService.del(getCouponPageKey(index + 1));
                }),
            );
        }

        return response.status;
    }

    @WrapWithLoading()
    async createReplenishPromocode(promoName: string, discount: number, countActivation = 1, activateAt?: string) {
        const headers = this.botTHeaders.getHeaders();
        const proxy = this.botTHeaders.getProxy();
        const params = { bot_id: this.sellerTradeBotId, type: '2' };

        if (!activateAt) {
            activateAt = dayjs().add(1, 'month').format('YYYY-MM-DDTHH:mm');
        }

        const csrf = this.botTHeaders.getCSRFToken();

        const payload = qs.stringify({
            '_csrf-frontend': csrf,
            'ShopCouponReplenishmentCreate[code]': promoName,
            'ShopCouponReplenishmentCreate[discount]': discount,
            'ShopCouponReplenishmentCreate[count]': countActivation,
            'ShopCouponReplenishmentCreate[only_one_user_one_coupon]': 0,
            'ShopCouponReplenishmentCreate[activate_at]': activateAt,
        });

        const url = this.urlBotT + `lk/common/shop/coupon/replenish`;
        let response;
        try {
            response = await this.httpService.post(url, payload, {
                headers: {
                    ...headers,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                params,
                proxy,
            });
        } catch (e: any) {
            if (e?.response?.status !== 302) {
                throw Error('Ошибка при создании промокода пополнения');
            }
            response = e.response;
        }

        this.botTHeaders.updateFromResponse(response);
        if (response.status === 200 || response.status === 201 || response.status === 302) {
            await Promise.all(
                Array.from({ length: 9 }, (_, index) => {
                    return this.cacheService.del(getCouponPageKey(index + 1));
                }),
            );
        }
        return response.status;
    }

    @WrapWithLoading()
    async searchOrderFromApi(accountId: string): Promise<string> {
        const headers = this.botTHeaders.getHeaders();
        const proxy = this.botTHeaders.getProxy();

        const params = {
            'OrderSearch[id]': '',
            'OrderSearch[shop_category_id]': '',
            'OrderSearch[sum_min]': '0',
            'OrderSearch[sum_max]': '',
            'OrderSearch[count_min]': '0',
            'OrderSearch[count_max]': '',
            'OrderSearch[user_id]': '',
            'OrderSearch[date_from]': '',
            'OrderSearch[date_to]': '',
            'OrderSearch[type]': '',
            'OrderSearch[item_id]': '',
            'OrderSearch[group_item_id]': '',
            'OrderSearch[product]': accountId,
            'OrderSearch[status]': '-1',
            bot_id: this.sellerTradeBotId,
        };
        const url = this.urlBotT + `lk/common/order/index`;
        const response = await this.httpService.get(url, { headers, params, proxy });
        this.botTHeaders.updateFromResponse(response);

        return response.data;
    }
}
