import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { getTelegramConfig } from '@common/telegram/telegram.config';
import { ConfigModule } from '@nestjs/config';
import { TelegramModule } from './module/telegram/telegram.module';
import { UserModule } from './module/user/user.module';
import { AccountModule } from './module/account/account.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ProxyModule } from './module/proxy/proxy.module';
import { HttpModule } from './module/http/http.module';
import { OrderModule } from './module/order/order.module';
import { ZennoModule } from './module/zenno/zenno.module';
import { AuthModule } from './module/auth/auth.module';

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
        AuthModule,
        TelegramModule,
        UserModule,
        AccountModule,
        ProxyModule,
        HttpModule,
        OrderModule,
        ZennoModule,
    ],
    controllers: [],
})
export class AppModule {}
