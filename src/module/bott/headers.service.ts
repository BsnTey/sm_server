import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../http/http.service';
import { ProxyService } from '../proxy/proxy.service';
import { getStatisticsKey } from '../cache/cache.keys';
import { RedisCacheService } from '../cache/cache.service';

@Injectable()
export class BotTHeadersService implements OnModuleInit {
    private readonly logger = new Logger(BotTHeadersService.name);

    private isUpdatingToken = false;
    private tokenUpdatePromise: Promise<void> | null = null;
    private proxy: string;

    private readonly urlBotT: string;
    private readonly sellerTradeBotId: string;
    private readonly browserServiceURL: string;
    private readonly nodeEnv: string;

    private userAgentWeb: string =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    private identityValue =
        '43de6ff6f603486a1d96939938761bc7002cccdfb0d932abad726ef0a43ef1d9a%3A2%3A%7Bi%3A0%3Bs%3A9%3A%22_identity%22%3Bi%3A1%3Bs%3A51%3A%22%5B722008%2C%22qVxIcyWHT2XUY5Ea-DeBfpyeJL3tTJmU%22%2C2592000%5D%22%3B%7D';

    private cookie: string = `_identity=${this.identityValue};`;
    private csrfToken?: string;

    constructor(
        private configService: ConfigService,
        private httpService: HttpService,
        private proxyService: ProxyService,
        private cacheService: RedisCacheService,
    ) {
        this.urlBotT = this.configService.getOrThrow('HOST_BOTT_W_PROTOCOL');
        this.sellerTradeBotId = this.configService.getOrThrow('SELLER_TRADE_BOT_ID');
        this.nodeEnv = this.configService.getOrThrow('NODE_ENV');
        this.browserServiceURL = this.configService.getOrThrow('BROWSER_SERVICE_URL');
    }

    async onModuleInit() {
        if (this.nodeEnv == 'developer') return;
        const proxyRaw = await this.proxyService.getRandomProxy();
        this.proxy = proxyRaw.proxy;
        await this.cacheService.del(getStatisticsKey());
        await this.updateTokenClaudeFlare();
    }

    updateFromResponse(response: any) {
        if (!response) return;

        const headers = response.headers || {};
        const setCookie = headers['set-cookie'] || headers['Set-Cookie'];
        if (setCookie) {
            this.updateCookiesFromHeaders(Array.isArray(setCookie) ? setCookie : [setCookie]);
        }

        if (typeof response.data === 'string' && response.data.includes('csrf-token')) {
            const match = response.data.match(/<meta name="csrf-token" content="(.*?)">/);
            if (match && match[1]) {
                this.csrfToken = match[1];
                this.logger.debug('CSRF Token автоматически обновлен из HTML');
            }
        }
    }

    getHeaders() {
        return {
            'User-Agent': this.userAgentWeb,
            Cookie: this.cookie,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Upgrade-Insecure-Requests': 1,
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        };
    }

    getAjaxHeaders() {
        return {
            'User-Agent': this.userAgentWeb,
            Cookie: this.cookie,
            Accept: 'application/json, text/javascript, */*; q=0.01',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
        };
    }

    getCSRFToken(): string {
        return this.csrfToken || '';
    }

    ensureTokenUpdated(): Promise<void> {
        if (!this.isUpdatingToken) {
            return Promise.resolve();
        }
        return this.tokenUpdatePromise || Promise.resolve();
    }

    public getIsUpdating(): boolean {
        return this.isUpdatingToken;
    }

    public getProxy(): string {
        return this.proxy;
    }

    private isCloudflareChallenge(data: any): boolean {
        if (typeof data !== 'string') return false;
        return data.includes('cf-challenge') || data.includes('__cf_chl_opt') || data.includes('Checking your browser');
    }

    async updateTokenClaudeFlare() {
        if (this.tokenUpdatePromise) {
            return this.tokenUpdatePromise;
        }

        this.isUpdatingToken = true;
        this.tokenUpdatePromise = (async () => {
            const statsUrl = `${this.urlBotT}lk/common/replenishment/main/statistics?bot_id=${this.sellerTradeBotId}`;
            const browserUrl = `${this.browserServiceURL}/browser/session`;

            try {
                this.logger.log('Попытка обновить токены запрос...');

                const payload = {
                    url: statsUrl,
                    inputCookies: this.parseCookieString(this.cookie),
                    targetCookie: 'cf_clearance',
                };

                const response = await this.httpService.post(browserUrl, payload, {
                    proxy: this.getProxy(),
                });

                // const response = await this.httpService.get(statsUrl, {
                //     proxy: 'socks5://nRGsZAT55r:iaOom16bsV@45.132.252.113:23248',
                // });

                if (response.data && response.data.success === true) {
                    this.updateFromBrowserData(response.data);
                    this.logger.log('Токены успешно обновлены через Browser Service');
                    return;
                } else {
                    const errorMsg = response.data?.error || 'Unknown browser error';
                    this.logger.warn(`Browser Service вернул ошибку: ${errorMsg}`);
                }

            } catch (error: any) {
                this.logger.warn(`Ошибка HTTP запроса (${error.message}), пробуем через браузер...`);
            }

            //пока коментирую, потом перенести на микросервис

            // let browser;
            // try {
            //     browser = await chromium.launch({
            //         headless: true,
            //         args: ['--disable-blink-features=AutomationControlled'],
            //     });
            //     const context = await browser.newContext({ userAgent: this.userAgentWeb });
            //
            //     await context.addCookies([
            //         {
            //             name: '_identity',
            //             value: this.identityValue,
            //             domain: this.hostBot,
            //             path: '/',
            //             httpOnly: true,
            //             secure: true,
            //         },
            //     ]);
            //
            //     const page = await context.newPage();
            //     await page.goto(statsUrl, {
            //         waitUntil: 'networkidle',
            //         timeout: 30000,
            //     });
            //
            //     await page.waitForSelector('div.card-header', { timeout: 15000 });
            //
            //     const html = await page.content();
            //     this.csrfToken = extractCsrf(html);
            //
            //     const cookieContext = await context.cookies();
            //     this.cookie = cookieContext.map((c: Cookie) => `${c.name}=${c.value}`).join('; ');
            //
            //     this.logger.log('Токены Bot-T обновлены успешно (через Browser)');
            // } catch (error: any) {
            //     this.logger.error('Критическая ошибка обновления токенов:', error.message);
            //     throw error;
            // } finally {
            //     if (browser) await browser.close();
            // }
        })().finally(() => {
            this.isUpdatingToken = false;
            this.tokenUpdatePromise = null;
        });

        return this.tokenUpdatePromise;
    }

    private updateCookiesFromHeaders(setCookieHeaders: string[] | undefined) {
        if (!setCookieHeaders) return;

        const currentCookies: Record<string, string> = {};

        this.cookie.split(';').forEach(c => {
            const [name, ...rest] = c.split('=');
            if (name && rest.length > 0) {
                const key = name.trim();
                if (key) currentCookies[key] = rest.join('=').trim();
            }
        });

        setCookieHeaders.forEach(header => {
            const cookiePair = header.split(';')[0];
            const [name, ...rest] = cookiePair.split('=');

            if (name && rest.length > 0) {
                const key = name.trim();
                currentCookies[key] = rest.join('=').trim();
            }
        });

        this.cookie =
            Object.entries(currentCookies)
                .map(([name, value]) => `${name}=${value}`)
                .join('; ') + ';';
    }

    private updateFromBrowserData(data: any) {
        if (!data) return;

        // 1. Обновляем User-Agent, если он пришел
        if (data.userAgent) {
            this.userAgentWeb = data.userAgent;
        }

        // 2. Обновляем куки
        if (data.allCookies) {
            // Парсим текущую строку кук в объект
            const currentCookies = this.parseCookieString(this.cookie);

            // Новые куки из браузера (это уже объект key: value)
            const browserCookies = data.allCookies;

            // Сливаем: новые перезаписывают старые
            const mergedCookies = { ...currentCookies, ...browserCookies };

            // Собираем обратно в строку
            this.cookie =
                Object.entries(mergedCookies)
                    .map(([name, value]) => `${name}=${value}`)
                    .join('; ') + ';';

            this.logger.log(`Куки обновлены из браузера. Всего ключей: ${Object.keys(mergedCookies).length}`);
        }
    }

    private parseCookieString(cookieString: string): Record<string, string> {
        const result: Record<string, string> = {};

        // 1. Разбиваем строку по точке с запятой ";"
        const pairs = cookieString.split(';');

        for (const pair of pairs) {
            // Убираем пробелы по краям
            const trimmedPair = pair.trim();

            if (!trimmedPair) continue; // Пропускаем пустые части (например, если в конце была ;)

            // 2. Ищем первый знак равенства "="
            const eqIndex = trimmedPair.indexOf('=');

            if (eqIndex === -1) continue; // Если "=" нет, это мусор

            // 3. Разбиваем на Ключ и Значение
            // Используем substring, а не split, чтобы не сломать значение, если в нем тоже есть "="
            const key = trimmedPair.substring(0, eqIndex).trim();
            result[key] = trimmedPair.substring(eqIndex + 1).trim();
        }

        return result;
    }
}
