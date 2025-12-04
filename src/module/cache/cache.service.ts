import { Inject, Injectable } from '@nestjs/common';
import { RedisClientType } from 'redis';
import { REDIS } from './cache.provider';
import { DISCOUNT_CACHE_PREFIXES } from './cache.keys';

@Injectable()
export class RedisCacheService {
    private readonly ttlSeconds = 60;

    constructor(@Inject(REDIS) private readonly client: RedisClientType) { }

    async set<T extends object>(key: string, value: T, ttlSeconds: number = this.ttlSeconds) {
        const stringify = JSON.stringify(value);
        await this.client.set(key, stringify, { EX: ttlSeconds });
    }

    async setPersistent<T extends object>(key: string, value: T): Promise<boolean> {
        const stringify = JSON.stringify(value);
        await this.client.set(key, stringify);
        return true;
    }

    async setUntilEndOfDay<T>(key: string, value: T) {
        const ttlSeconds = this.getSecondsUntilEndOfDayMsk();
        const stringify = JSON.stringify(value);
        await this.client.set(key, stringify, { EX: ttlSeconds });
    }

    async mget(keys: string[]): Promise<(string | null)[]> {
        if (keys.length === 0) return [];
        return this.client.mGet(keys);
    }

    /**
     * Сохраняет множество ключей с одинаковым TTL (до конца дня по МСК)
     */
    async msetUntilEndOfDay(items: Record<string, any>) {
        const keys = Object.keys(items);
        if (keys.length === 0) return;

        const ttlSeconds = this.getSecondsUntilEndOfDayMsk();
        const multi = this.client.multi();

        for (const [key, value] of Object.entries(items)) {
            multi.set(key, JSON.stringify(value), { EX: ttlSeconds });
        }

        await multi.exec();
    }

    /**
     * Вспомогательный метод для расчета секунд до полуночи по Москве
     */
    private getSecondsUntilEndOfDayMsk(): number {
        const now = new Date();

        const moscowTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));

        const nextMidnightMsk = new Date(moscowTime);
        nextMidnightMsk.setDate(nextMidnightMsk.getDate() + 1);
        nextMidnightMsk.setHours(0, 0, 0, 0);

        return Math.max(1, Math.floor((nextMidnightMsk.getTime() - moscowTime.getTime()) / 1000));
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

    /**
     * Очистка всего кеша, связанного со скидками
     */
    async clearDiscountRelatedCache(): Promise<void> {
        for (const prefix of DISCOUNT_CACHE_PREFIXES) {
            await this.delByPrefix(prefix);
        }
    }
}

