import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../module/http/http.service';
import { BrowserSessionResult, InputBrowserData } from './interfaces/dto.interface';

@Injectable()
export class HttpBrowserGateway {
    private readonly url: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly config: ConfigService,
    ) {
        this.url = this.config.getOrThrow('BROWSER_SERVICE_URL');
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
                timeout: 60,
            },
        );

        return response.data;
    }
}
