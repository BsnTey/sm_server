import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BasicAuthMiddleware } from '@common/middleware/basic-auth.middleware';
import { courseViewing } from './bullmq.queues';

@Global()
@Module({
    imports: [
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => {
                const url = configService.getOrThrow<string>('REDIS_CONNECTION_URL');
                const redisUrl = new URL(url);

                return {
                    connection: {
                        host: redisUrl.hostname,
                        port: Number(redisUrl.port),
                        password: redisUrl.password,
                        db: 1, // БАЗА №1 ДЛЯ ОЧЕРЕДЕЙ
                    },
                };
            },
            inject: [ConfigService],
        }),

        // 2. Настройка админ-панели (Root)
        BullBoardModule.forRoot({
            route: '/admin/queues',
            adapter: ExpressAdapter,
            middleware: [BasicAuthMiddleware],
        }),

        BullModule.registerQueue({
            name: courseViewing,
        }),

        // 4. Подключение очереди к панели
        BullBoardModule.forFeature({
            name: courseViewing,
            adapter: BullMQAdapter,
        }),
    ],
    providers: [BasicAuthMiddleware],
    exports: [BullModule],
})
export class BullConfigModule {}
