import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IProxyDict } from './interfaces/proxy.interface';
import { ERROR_FREE_PROXY } from './error/error.constant';

@Injectable()
export class ProxyService {
    public proxyList: string[];
    public proxyDict: IProxyDict = {};

    constructor(private configService: ConfigService) {
        const PROXY_ENV = this.configService.getOrThrow<string>('PROXY_LIST');
        this.proxyList = PROXY_ENV.split(',');

        this.proxyList.forEach(line => {
            this.proxyDict[line] = {
                isBan: false,
                timeBlock: new Date(),
            };
        });
    }

    getRandomProxy() {
        const currentTime = new Date();
        const proxyListCopy = [...this.proxyList];

        while (proxyListCopy.length > 0) {
            const randomIndex = Math.floor(Math.random() * proxyListCopy.length);
            const randomProxy = proxyListCopy[randomIndex];

            const proxyData = this.proxyDict[randomProxy];

            if (!proxyData.isBan) {
                return randomProxy;
            } else if (proxyData.isBan && currentTime.getTime() - proxyData.timeBlock.getTime() > 10 * 60 * 1000) {
                proxyData.isBan = false;
                proxyData.timeBlock = new Date();
                return randomProxy;
            }

            proxyListCopy.splice(randomIndex, 1);
        }

        throw new Error(ERROR_FREE_PROXY);
    }

    setProxyBan(proxy: string) {
        this.proxyDict[proxy].isBan = true;
        this.proxyDict[proxy].timeBlock = new Date();
    }
}
