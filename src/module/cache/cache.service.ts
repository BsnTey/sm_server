import { Inject, Injectable } from '@nestjs/common';
import { RedisClientType } from 'redis';
import { REDIS } from './cache.provider';

@Injectable()
export class RedisCacheService {
    private readonly ttlSeconds = 60;

    constructor(@Inject(REDIS) private readonly client: RedisClientType) {}

    async set<T extends object>(key: string, value: T, ttlSeconds: number = this.ttlSeconds) {
        const stringify = JSON.stringify(value);
        await this.client.set(key, stringify, { EX: ttlSeconds });
    }

    async setPersistent<T extends object>(key: string, value: T): Promise<boolean> {
        const stringify = JSON.stringify(value);
        await this.client.set(key, stringify);
        return true;
    }

    async get<T extends object>(key: string): Promise<T | null> {
        const result = await this.client.get(key);
        return result ? (JSON.parse(result) as T) : null;
    }

    async del(key: string) {
        await this.client.del(key);
    }

    async lpush(key: string, value: string) {
        return this.client.lPush(key, value);
    }

    async rpop(key: string): Promise<string | null> {
        return this.client.rPop(key);
    }

    async delByPrefix(prefix: string): Promise<void> {
        const keys = await this.client.keys(`${prefix}*`);
        if (keys.length > 0) {
            await this.client.del(keys);
        }
    }
}
