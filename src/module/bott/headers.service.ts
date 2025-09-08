import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { chromium, Cookie } from 'patchright';
import { extractCsrf } from '../telegram/utils/payment.utils';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BotTHeadersService implements OnModuleInit {
    private readonly logger = new Logger(BotTHeadersService.name);

    private isUpdatingToken = false;
    private tokenUpdatePromise: Promise<void> | null = null;

    private urlBotT: string = this.configService.getOrThrow('HOST_BOTT_W_PROTOCOL');
    private sellerTradeBotId: string = this.configService.getOrThrow('SELLER_TRADE_BOT_ID');
    private hostBot: string = this.configService.getOrThrow('HOST_BOTT');

    private userAgentWeb: string =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

    private identificationCookie = [
        {
            name: '_identity',
            value: '43de6ff6f603486a1d96939938761bc7002cccdfb0d932abad726ef0a43ef1d9a%3A2%3A%7Bi%3A0%3Bs%3A9%3A%22_identity%22%3Bi%3A1%3Bs%3A51%3A%22%5B722008%2C%22qVxIcyWHT2XUY5Ea-DeBfpyeJL3tTJmU%22%2C2592000%5D%22%3B%7D',
            domain: this.hostBot,
            path: '/',
            httpOnly: true,
            secure: true,
        },
    ];

    private cookie: string;
    private csrfToken: string;

    constructor(private configService: ConfigService) {}

    async onModuleInit() {
        await this.updateTokenClaudeFlare();
    }

    public getIsUpdating(): boolean {
        return this.isUpdatingToken;
    }

    getHeaders() {
        return {
            'User-Agent': this.userAgentWeb,
            Cookie: this.cookie,
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

    async updateTokenClaudeFlare() {
        if (this.tokenUpdatePromise) {
            return this.tokenUpdatePromise;
        }
        this.isUpdatingToken = true;
        this.tokenUpdatePromise = (async () => {
            try {
                const browser = await chromium.launch({ headless: false });
                const context = await browser.newContext({ userAgent: this.userAgentWeb });
                await context.addCookies(this.identificationCookie);

                const page = await context.newPage();
                await page.goto(`${this.urlBotT}lk/common/replenishment/main/statistics?bot_id=${this.sellerTradeBotId}`, {
                    waitUntil: 'networkidle',
                    timeout: 30000,
                });

                await page.waitForSelector('div.card-header:has-text("Топ 20 пользователей по сумме за период")', { timeout: 15000 });

                const html = await page.content();
                this.csrfToken = extractCsrf(html);

                const cookieContext = await context.cookies();
                this.cookie = cookieContext.map((c: Cookie) => `${c.name}=${c.value}`).join('; ');

                await browser.close();
                this.logger.log('Токены Bot-T обновлены успешно');
            } catch (error: any) {
                this.logger.error('Ошибка обновления Cloudflare токена:', error);
                throw new Error(`Ошибка обновления Bot-T токена: ${error.message}`);
            } finally {
                this.isUpdatingToken = false;
                this.tokenUpdatePromise = null;
            }
        })();
        return this.tokenUpdatePromise;
    }
}
