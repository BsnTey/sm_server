import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IProxyDict } from './interfaces/proxy.interface';

@Injectable()
export class ProxyService {
    public proxyList: string[];
    public proxyDict: IProxyDict = {};

    constructor(private configService: ConfigService) {
        const PROXY_LIST = this.configService.getOrThrow<string[]>('PROXY_LIST');
        const proxyList = [];
        for (const proxy of PROXY_LIST) {
            if (proxy.length == 0) continue;
            proxyList.push(proxy.trim());
        }

        this.proxyList = proxyList;

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

        throw new Error('No available proxy found');
    }

    setProxyBan(proxy: string) {
        this.proxyDict[proxy].isBan = true;
        this.proxyDict[proxy].timeBlock = new Date();
    }
}
