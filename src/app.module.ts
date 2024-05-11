import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { getTelegramConfig } from '@common/telegram/telegram.config';
import { ConfigModule } from '@nestjs/config';
import { TelegramModule } from './module/telegram/telegram.module';
import { UserModule } from './module/user/user.module';
import { SportModule } from './module/sport/sport.module';
import { AccountModule } from './module/account/account.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        TelegrafModule.forRootAsync(getTelegramConfig()),
        TelegramModule,
        UserModule,
        SportModule,
        AccountModule,
    ],
    controllers: [],
})
export class AppModule {}
