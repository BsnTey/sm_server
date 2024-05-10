import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { getTelegramConfig } from '@common/telegram/telegram.config';
import { ConfigModule } from '@nestjs/config';
import { TelegramModule } from './module/telegram/telegram.module';
import { UserModule } from './module/user/user.module';
import { APP_FILTER } from '@nestjs/core';
import { TelegrafExceptionFilter } from '@common/filters/telegraf-exception.filter';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        TelegrafModule.forRootAsync(getTelegramConfig()),
        TelegramModule,
        UserModule,
        // AccountModule,
    ],
    controllers: [],
    providers: [
        {
            provide: APP_FILTER,
            useClass: TelegrafExceptionFilter,
        },
    ],
})
export class AppModule {}
