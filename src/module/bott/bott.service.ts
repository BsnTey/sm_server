import { BadRequestException, Inject, Injectable, Logger, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../http/http.service';
import { BotTHeadersService } from './headers.service';
import { Html, ISearchByTelegramId } from './interfaces/bot-t.interface';
import { IReplenishmentUsersBotT } from './interfaces/replenishment-bot-t.interface';
import qs from 'qs';
import { ERROR_GET_STATISTICS } from '../payment/constants/error.constants';
import dayjs from 'dayjs';
import sleep from 'sleep-promise';
import { WrapWithLoading } from './decorators/wrap-with-loading.decorator';
import { Cache, CACHE_MANAGER, CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { getCouponPageKey } from '../cache/cache.keys';

@UseInterceptors(CacheInterceptor)
@Injectable()
export class BottService {
    private readonly logger = new Logger(BottService.name);

    private urlBotT: string = this.configService.getOrThrow('HOST_BOTT_W_PROTOCOL');
    private apiUrlBotT: string = this.configService.getOrThrow('API_BOTT_W_PROTOCOL');
    private sellerTradeBotId: string = this.configService.getOrThrow('SELLER_TRADE_BOT_ID');
    private sellerTradeBotToken: string = this.configService.getOrThrow('SELLER_TRADE_TOKEN');

    constructor(
        private configService: ConfigService,
        private httpService: HttpService,
        private botTHeaders: BotTHeadersService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {}

    private async wrapperFuncLoading<T>(funcToExecute: () => Promise<T>): Promise<T> {
        const MAX_RETRIES = 5;
        const RETRY_DELAY_MS = 1000;

        await this.botTHeaders.ensureTokenUpdated();

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (attempt > 1 || this.botTHeaders.getIsUpdating()) {
                    await this.botTHeaders.ensureTokenUpdated();
                }
                return await funcToExecute();
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
                    this.logger.warn(
                        `Попытка ${attempt} провалена, но не связана с обновлением токена: ${error.message}. Пытаюсь еще раз...`,
                    );
                    await sleep(RETRY_DELAY_MS * attempt);
                } else {
                    this.logger.error(`Все ${MAX_RETRIES} попытки провалены. Последняя ошибка: ${error.message}`);
                    throw new Error(`Провалено максимально попыток ${MAX_RETRIES}: ${error.message}`);
                }
            }
        }
        throw new Error('Неизвестная ошибка в wrapperFuncLoading');
    }

    private isCloudflareOrAuthError(error: any): boolean {
        if (error.isAxiosError && error.response) {
            const status = error.response.status;
            return [401, 403].includes(status) || (status === 503 && error.response.data?.includes('Cloudflare'));
        }
        return !!(error.message?.includes('challenge') || error.message?.includes('captcha'));
    }

    @CacheKey('bott:searchIdByTelegramId')
    @CacheTTL(86_400_1000)
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

    @WrapWithLoading()
    @CacheKey('bott:getUserBotId')
    @CacheTTL(10_1000)
    async pageSearchUserByTelegramId(searchId: string): Promise<string> {
        const headers = this.botTHeaders.getHeaders();

        const params = {
            bot_id: this.sellerTradeBotId,
            'BotUserSearch[user_id]': searchId,
        };
        const url = this.urlBotT + `lk/common/users/users/index`;
        const response = await this.httpService.get(url, { headers, params });
        return response.data;
    }

    @WrapWithLoading()
    async userBalanceEdit(userBotId: string, amount: string, isPositive: boolean): Promise<string> {
        const headers = this.botTHeaders.getHeaders();

        const params = {
            id: userBotId,
            bot_id: this.sellerTradeBotId,
        };
        const payload = qs.stringify({
            '_csrf-frontend': this.botTHeaders.getCSRFToken(),
            'UserEditBalanceForm[balance]': amount,
            'UserEditBalanceForm[is_positive]': +isPositive,
        });

        const url = this.urlBotT + `lk/common/users/user/balance-edit`;
        const response = await this.httpService.post(url, payload, { headers, params });
        await this.cacheManager.del('bott:getStatistics');
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

    @WrapWithLoading()
    @CacheKey('bott:getStatistics')
    @CacheTTL(3_600_1000)
    async getStatistics(): Promise<Html> {
        const params = {
            bot_id: this.sellerTradeBotId,
        };

        const url = this.urlBotT + `lk/common/replenishment/main/statistics`;
        const headers = this.botTHeaders.getHeaders();

        try {
            const response = await this.httpService.get(url, { headers, params });
            return response.data;
        } catch (err) {
            throw new BadRequestException(ERROR_GET_STATISTICS);
        }
    }

    @WrapWithLoading()
    async getCouponPage(page = 1): Promise<Html> {
        const cacheKey = getCouponPageKey(page);
        const cached = await this.cacheManager.get<Html>(cacheKey);
        if (cached) {
            this.logger.log(`Отдал данные по ключу ${cacheKey}`);
            return cached;
        }

        const headers = this.botTHeaders.getHeaders();
        const params = {
            bot_id: this.sellerTradeBotId,
            page,
        };

        const url = this.urlBotT + `lk/common/shop/coupon/index`;
        const response = await this.httpService.get(url, { headers, params });

        await this.cacheManager.set(cacheKey, response.data, 300_1000);
        this.logger.log(`Сохранил данные по ключу ${cacheKey}`);

        return response.data;
    }

    @WrapWithLoading()
    async createPromocode(csrfToken: string, promoName: string, discountPercent: number, countActivation = 5, activateAt?: string) {
        const headers = this.botTHeaders.getHeaders();
        const params = {
            bot_id: this.sellerTradeBotId,
            type: '0',
        };

        if (!activateAt) {
            activateAt = dayjs().add(1, 'month').format('YYYY-MM-DDTHH:mm');
        }

        const payload = qs.stringify({
            '_csrf-frontend': this.botTHeaders.getCSRFToken(),
            'ShopCouponCreateForm[code]': promoName,
            'ShopCouponCreateForm[count]': countActivation,
            'ShopCouponCreateForm[min_price]': 50,
            'ShopCouponCreateForm[only_first]': 0,
            'ShopCouponCreateForm[only_one_user_one_coupon]': 0,
            'ShopCouponCreateForm[activate_at]': activateAt,
            'ShopCouponCreateForm[discount]': discountPercent,
        });

        const url = this.urlBotT + `lk/common/shop/coupon/create`;
        const response = await this.httpService.post(url, payload, { headers, params });
        if (response.status === 200 || response.status === 201) {
            this.logger.log(`Удалил данные промокодов на страницах`);
            await Promise.all(
                Array.from({ length: 9 }, (_, index) => {
                    const page = index + 1;
                    const cacheKey = getCouponPageKey(page);
                    return this.cacheManager.del(cacheKey);
                }),
            );
        }

        return response.status;
    }

    @WrapWithLoading()
    async createReplenishPromocode(csrfToken: string, promoName: string, discount: number, countActivation = 1, activateAt?: string) {
        const headers = this.botTHeaders.getHeaders();

        const params = {
            bot_id: this.sellerTradeBotId,
            type: '2',
        };

        if (!activateAt) {
            activateAt = dayjs().add(1, 'month').format('YYYY-MM-DDTHH:mm');
        }

        const payload = qs.stringify({
            '_csrf-frontend': this.botTHeaders.getCSRFToken(),
            'ShopCouponReplenishmentCreate[code]': promoName,
            'ShopCouponReplenishmentCreate[discount]': discount,
            'ShopCouponReplenishmentCreate[count]': countActivation,
            'ShopCouponReplenishmentCreate[only_one_user_one_coupon]': 0,
            'ShopCouponReplenishmentCreate[activate_at]': activateAt,
        });

        const url = this.urlBotT + `lk/common/shop/coupon/replenish`;
        const response = await this.httpService.post(url, payload, { headers, params });
        if (response.status === 200 || response.status === 201) {
            await Promise.all(
                Array.from({ length: 9 }, (_, index) => {
                    const page = index + 1;
                    const cacheKey = getCouponPageKey(page);
                    this.cacheManager.del(cacheKey);
                }),
            );
        }
        return response.status;
    }
}
