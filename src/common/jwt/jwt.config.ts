import { JwtModuleAsyncOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const getJWTConfig = (): JwtModuleAsyncOptions => ({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => ({
        global: true,
        secret: configService.getOrThrow('ACCESS_TOKEN_JWT_SECRET'),
        signOptions: {
            expiresIn: configService.getOrThrow('ACCESS_TOKEN_EXPIRATION'),
        },
    }),
});
