import { Injectable } from '@nestjs/common';
import { HttpBrowserGateway } from '../../shared/browser/browser.service';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from '../cache/cache.service';

const qratorCache = (proxy: string) => `qrator:${proxy}`;
const TTL_QRATOR = 3600;

@Injectable()
export class ProtectionToken {
    private readonly urlSite: string;

    constructor(
        private readonly httpService: HttpBrowserGateway,
        private readonly configService: ConfigService,
        private cacheService: RedisCacheService,
    ) {
        this.urlSite = this.configService.getOrThrow('API_DONOR_SITE');
    }

    async getQratorJsid(proxy: string) {
        const key = qratorCache(proxy);

        const cached = await this.cacheService.get<{ value: string }>(key);

        if (cached?.value) return cached.value;

        const response = await this.httpService.solveChallenge({
            url: this.urlSite,
            proxy,
            targetCookie: 'qrator_jsid',
        });

        const isSuccess = response.success;
        if (!isSuccess) throw new Error('no success response');
        if (!response.cookieValue) throw new Error('no response qrator');

        await this.cacheService.set<{ value: string }>(key, { value: response.cookieValue }, TTL_QRATOR);

        return response.cookieValue;
    }
}
