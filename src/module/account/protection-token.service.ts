import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpBrowserGateway } from '../../shared/browser/browser.service';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from '../cache/cache.service';
import { setTimeout } from 'timers/promises';

const CACHE_TTL_QRATOR = 3600;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

@Injectable()
export class ProtectionToken {
    private readonly logger = new Logger(ProtectionToken.name);
    private readonly urlSite: string;

    constructor(
        private readonly httpService: HttpBrowserGateway,
        private readonly configService: ConfigService,
        private readonly cacheService: RedisCacheService,
    ) {
        this.urlSite = this.configService.getOrThrow<string>('API_DONOR_SITE');
    }

    /**
     * Получает JSID токен.
     * Сначала ищет в кэше, при отсутствии — запрашивает у провайдера с механизмом повторных попыток.
     */
    async getQratorJsid(proxy: string): Promise<string> {
        const cacheKey = this.getCacheKey(proxy);

        try {
            const cached = await this.cacheService.get<{ value: string }>(cacheKey);
            if (cached?.value) {
                return cached.value;
            }
        } catch (err: any) {
            this.logger.error(`Error reading from cache: ${err.message}`, err.stack);
        }

        this.logger.log(`Cache miss. Fetching new token for proxy: ${proxy}`);
        const token = await this.executeWithRetry(() => this.fetchTokenFromProvider(proxy));

        await this.cacheService
            .set(cacheKey, { value: token }, CACHE_TTL_QRATOR)
            .catch(err => this.logger.error(`Failed to set cache: ${err.message}`));

        return token;
    }

    /**
     * Логика выполнения "тяжелого" запроса к браузеру
     */
    private async fetchTokenFromProvider(proxy: string): Promise<string> {
        const response = await this.httpService.solveChallenge({
            url: this.urlSite,
            proxy,
            targetCookie: 'qrator_jsid',
        });

        if (!response.success) {
            throw new Error(`Browser gateway returned success=false`);
        }

        if (!response.cookieValue) {
            throw new Error(`Cookie 'qrator_jsid' not found in response`);
        }

        return response.cookieValue;
    }

    /**
     * Обертка для retry-логики
     */
    private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
        let lastError: Error | unknown;

        for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                const isLastAttempt = attempt === RETRY_ATTEMPTS;

                this.logger.warn(
                    `Attempt ${attempt}/${RETRY_ATTEMPTS} failed. ${isLastAttempt ? 'Giving up.' : `Retrying in ${RETRY_DELAY_MS}ms.`} Error: ${error instanceof Error ? error.message : error}`
                );

                if (!isLastAttempt) {
                    await setTimeout(RETRY_DELAY_MS);
                }
            }
        }

        throw new ServiceUnavailableException(
            `Failed to get protection token after ${RETRY_ATTEMPTS} attempts. Last error: ${lastError instanceof Error ? lastError.message : lastError}`,
        );
    }

    private getCacheKey(proxy: string): string {
        return `qrator:${proxy}`;
    }
}
