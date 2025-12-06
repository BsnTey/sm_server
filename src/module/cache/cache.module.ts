import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { RedisClientType } from 'redis';
import { REDIS, redisProvider } from './cache.provider';
import { RedisCacheService } from './cache.service';

@Global()
@Module({
    providers: [redisProvider, RedisCacheService],
    exports: [RedisCacheService],
})
export class RedisCacheModule implements OnApplicationShutdown {
    @Inject(REDIS)
    private readonly client: RedisClientType;

    async onApplicationShutdown() {
        await this.client.quit();
    }
}
