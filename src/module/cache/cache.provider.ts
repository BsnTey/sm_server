import { Logger, Provider } from '@nestjs/common';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';

export const REDIS = 'REDIS_CLIENT';

export const redisProvider: Provider = {
    provide: REDIS,
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => {
        const logger = new Logger('RedisProvider');

        const url = configService.getOrThrow<string>('REDIS_CONNECTION_URL');

        const sanitizedUrl = url.replace(/(:)([^@]+)(@)/, '$1***$3');
        logger.log(`Connecting to Redis at: ${sanitizedUrl}`);

        const client = createClient({
            url: url,
        });

        client.on('error', err => {
            logger.error(`Redis Client Error: ${err.message}`, err.stack);
        });

        client.on('connect', () => {
            logger.log('Redis Client Connected');
        });

        client.on('ready', () => {
            logger.log('Redis Client Ready');
        });

        await client.connect();
        return client;
    },
};
