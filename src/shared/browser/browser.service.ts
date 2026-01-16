import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../module/http/http.service';
import { BrowserSessionResult, InputBrowserData } from './interfaces/dto.interface';

@Injectable()
export class HttpBrowserGateway {
    private readonly url: string;
    private readonly TIMEOUT_SEC: number;

    constructor(
        private readonly httpService: HttpService,
        private readonly config: ConfigService,
    ) {
        this.url = this.config.getOrThrow('BROWSER_SERVICE_URL');
        this.TIMEOUT_SEC = 60 * 1000;
    }

    async solveChallenge({ url, proxy, inputCookies, targetCookie }: InputBrowserData): Promise<BrowserSessionResult> {
        const response = await this.httpService.post(
            `${this.url}/browser/session`,
            {
                url,
                proxy,
                targetCookie,
                inputCookies,
            },
            {
                timeout: this.TIMEOUT_SEC,
            },
        );

        return response.data;
    }
}
