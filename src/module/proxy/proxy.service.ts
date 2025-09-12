import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProxyRepository } from './proxy.repository';
import { ProxyEntity } from './entities/proxy.entity';
import { ERROR_FREE_PROXY } from './error/error.constant';

@Injectable()
export class ProxyService implements OnModuleInit {
    private readonly logger = new Logger(ProxyService.name);

    constructor(private proxyRepository: ProxyRepository) {}

    async onModuleInit() {
        this.logger.log('Checking proxies on module initialization...');
        try {
            const proxies = await this.listProxies({});
            if (proxies.items.length === 0) {
                this.logger.warn('No proxies found in the database to check.');
                return;
            }

            for (const proxy of proxies.items) {
                if (proxy.expiresAt < new Date()) {
                    throw new Error(`Proxy ${proxy.proxy} has expired (expires at: ${proxy.expiresAt.toISOString()})`);
                }
            }

            this.logger.log('All proxies are valid.');
        } catch (error: any) {
            this.logger.error('CRITICAL STARTUP ERROR: An expired proxy was found. Application will terminate.');
            this.logger.error(error.message);
        }
    }

    async getRandomProxy(): Promise<ProxyEntity> {
        const proxies = await this.proxyRepository.getAllAvailableProxy(new Date());
        if (proxies.length == 0) throw new Error(ERROR_FREE_PROXY);
        const index = Math.floor(Math.random() * proxies.length);
        const proxy = proxies[index];
        return new ProxyEntity(proxy);
    }

    async listProxies(pagination: { page?: number; limit?: number }) {
        const page = Math.max(1, pagination?.page ?? 1);
        const limit = Math.min(200, Math.max(1, pagination?.limit ?? 50));
        return this.proxyRepository.list(page, limit);
    }

    async updateProxy(uuid: string, dto: { proxy?: string; expiresAt?: Date; blockedAt?: Date | null }) {
        return this.proxyRepository.update(uuid, dto);
    }
}
