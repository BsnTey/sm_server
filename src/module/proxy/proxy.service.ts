import { Injectable } from '@nestjs/common';
import { ProxyRepository } from './proxy.repository';
import { ProxyEntity } from './entities/proxy.entity';
import { ERROR_FREE_PROXY } from './error/error.constant';

@Injectable()
export class ProxyService {
    constructor(private proxyRepository: ProxyRepository) {}

    // async addingProxy(proxys: string[]) {
    //
    // }

    async getRandomProxy(): Promise<ProxyEntity> {
        const proxies = await this.proxyRepository.getAllAvailableProxy(new Date());
        if (proxies.length == 0) throw new Error(ERROR_FREE_PROXY);
        const index = Math.floor(Math.random() * proxies.length);
        const proxy = proxies[index];
        return new ProxyEntity(proxy);
    }

    // setProxyBan(proxy: string) {
    //     this.proxyDict[proxy].isBan = true;
    //     this.proxyDict[proxy].timeBlock = new Date();
    // }
}
