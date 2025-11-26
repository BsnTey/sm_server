import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { RedisClientType } from 'redis';
import { REDIS, redisProvider } from './cache.provider';
import { CacheService } from './cache.service';

@Global()
@Module({
    providers: [redisProvider, CacheService],
    exports: [CacheService],
})
export class CacheModule implements OnApplicationShutdown {
    @Inject(REDIS)
    private readonly client: RedisClientType;

    async onApplicationShutdown() {
        await this.client.quit();
    }
}
