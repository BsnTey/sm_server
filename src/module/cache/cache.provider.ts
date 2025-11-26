import { Logger, Provider } from '@nestjs/common';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';

export const REDIS = 'REDIS_CLIENT';

export const redisProvider: Provider = {
    provide: REDIS,
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => {
        const logger = new Logger('RedisProvider');

        const client = createClient({
            url: configService.getOrThrow<string>('REDIS_CONNECTION_URL'),
        });

        client.on('error', err => {
            logger.error('Redis Client Error', err);
        });

        client.on('connect', () => {
            logger.log('Redis Client Connected');
        });

        await client.connect();
        return client;
    },
};
