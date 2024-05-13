import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { getTelegramConfig } from '@common/telegram/telegram.config';
import { ConfigModule } from '@nestjs/config';
import { TelegramModule } from './module/telegram/telegram.module';
import { UserModule } from './module/user/user.module';
import { AccountModule } from './module/account/account.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ProxyModule } from './module/proxy/proxy.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        CacheModule.register({
            isGlobal: true,
            ttl: 18000000,
            max: 1000,
        }),
        TelegrafModule.forRootAsync(getTelegramConfig()),
        TelegramModule,
        UserModule,
        AccountModule,
        ProxyModule,
    ],
    controllers: [],
})
export class AppModule {}
