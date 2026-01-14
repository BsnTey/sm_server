import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProxyRepository } from './proxy.repository';
import { ProxyEntity } from './entities/proxy.entity';
import { ERROR_FREE_PROXY } from './error/error.constant';
import { CreateProxiesDto } from './dto/create-proxies.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProxyService implements OnModuleInit {
    private readonly logger = new Logger(ProxyService.name);
    private readonly blockTime: number;

    constructor(
        private configService: ConfigService,
        private proxyRepository: ProxyRepository,
    ) {
        this.blockTime = +this.configService.getOrThrow<number>('PROXY_BLOCK_TIME_MINUTES');
    }

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
        const proxies = await this.proxyRepository.getAllAvailableProxy(new Date(), this.blockTime);
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

    async clearAllProxies() {
        this.logger.warn('Clearing all proxies from the database.');
        return this.proxyRepository.clearAll();
    }

    async addProxies(dto: CreateProxiesDto) {
        this.logger.log(`Adding ${dto.proxies.length} new proxies.`);
        return this.proxyRepository.createMany(dto.proxies);
    }
}
