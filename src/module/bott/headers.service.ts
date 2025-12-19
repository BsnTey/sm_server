import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { chromium, Cookie } from 'patchright';
import { extractCsrf } from '../telegram/utils/payment.utils';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../http/http.service';

@Injectable()
export class BotTHeadersService implements OnModuleInit {
    private readonly logger = new Logger(BotTHeadersService.name);

    private isUpdatingToken = false;
    private tokenUpdatePromise: Promise<void> | null = null;

    private urlBotT: string = this.configService.getOrThrow('HOST_BOTT_W_PROTOCOL');
    private sellerTradeBotId: string = this.configService.getOrThrow('SELLER_TRADE_BOT_ID');
    private hostBot: string = this.configService.getOrThrow('HOST_BOTT');
    private nodeEnv: string = this.configService.getOrThrow('NODE_ENV');

    private userAgentWeb: string =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

    private identityValue =
        '43de6ff6f603486a1d96939938761bc7002cccdfb0d932abad726ef0a43ef1d9a%3A2%3A%7Bi%3A0%3Bs%3A9%3A%22_identity%22%3Bi%3A1%3Bs%3A51%3A%22%5B722008%2C%22qVxIcyWHT2XUY5Ea-DeBfpyeJL3tTJmU%22%2C2592000%5D%22%3B%7D';

    private cookie: string = `_identity=${this.identityValue};`;
    private csrfToken: string;

    constructor(
        private configService: ConfigService,
        private httpService: HttpService,
    ) {}

    async onModuleInit() {
        if (this.nodeEnv == 'developer') return;
        await this.updateTokenClaudeFlare();
    }

    getHeaders() {
        return {
            'User-Agent': this.userAgentWeb,
            Cookie: this.cookie,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Upgrade-Insecure-Requests': '1',
        };
    }

    getCSRFToken() {
        return this.csrfToken;
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

            try {
                this.logger.log('Попытка обновить токены через быстрый HTTP запрос...');

                const response = await this.httpService.get(statsUrl, {
                    headers: this.getHeaders(),
                });

                if (!this.isCloudflareChallenge(response.data)) {
                    this.csrfToken = extractCsrf(response.data);

                    const setCookie = response.headers['set-cookie'];
                    this.updateCookiesFromHeaders(setCookie);

                    this.logger.log('Токены обновлены через HTTP');
                    return;
                }

                this.logger.warn('Обнаружена защита Cloudflare, переключаемся на браузер...');
            } catch (error: any) {
                this.logger.warn(`Ошибка HTTP запроса (${error.message}), пробуем через браузер...`);
            }

            let browser;
            try {
                browser = await chromium.launch({
                    headless: true,
                    args: ['--disable-blink-features=AutomationControlled'],
                });
                const context = await browser.newContext({ userAgent: this.userAgentWeb });

                await context.addCookies([
                    {
                        name: '_identity',
                        value: this.identityValue,
                        domain: this.hostBot,
                        path: '/',
                        httpOnly: true,
                        secure: true,
                    },
                ]);

                const page = await context.newPage();
                await page.goto(statsUrl, {
                    waitUntil: 'networkidle',
                    timeout: 30000,
                });

                await page.waitForSelector('div.card-header', { timeout: 15000 });

                const html = await page.content();
                this.csrfToken = extractCsrf(html);

                const cookieContext = await context.cookies();
                this.cookie = cookieContext.map((c: Cookie) => `${c.name}=${c.value}`).join('; ');

                this.logger.log('Токены Bot-T обновлены успешно (через Browser)');
            } catch (error: any) {
                this.logger.error('Критическая ошибка обновления токенов:', error.message);
                throw error;
            } finally {
                if (browser) await browser.close();
            }
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
            const [name, value] = c.split('=').map(s => s.trim());
            if (name && value) currentCookies[name] = value;
        });

        setCookieHeaders.forEach(header => {
            const [pair] = header.split(';');
            const [name, value] = pair.split('=').map(s => s.trim());
            if (name && value) currentCookies[name] = value;
        });

        this.cookie =
            Object.entries(currentCookies)
                .map(([name, value]) => `${name}=${value}`)
                .join('; ') + ';';
    }
}
