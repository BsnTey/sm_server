import { sessionMiddleware } from '@common/middleware/session.middleware';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const getTelegramConfig = () => ({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => ({
        token: configService.getOrThrow('TELEGRAM_TOKEN'),
        middlewares: [sessionMiddleware],
        include: [],
    }),
});
