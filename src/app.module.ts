import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { getTelegramConfig } from '@common/telegram/telegram.config';
import { ConfigModule } from '@nestjs/config';
import { TelegramModule } from './module/telegram/telegram.module';
import { AccountModule } from './module/account/account.module';
import { ProxyModule } from './module/proxy/proxy.module';
import { HttpModule } from './module/http/http.module';
import { OrderModule } from './module/order/order.module';
import { ZennoModule } from './module/zenno/zenno.module';
import { AuthModule } from './module/auth/auth.module';
import { MirrorModule } from './module/mirror/mirror.module';
import { SharedModule } from './module/shared/shared.module';
import { BottModule } from './module/bott/bott.module';
import { PaymentModule } from './module/payment/payment.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './module/cron/cron.module';
import { WebappModule } from './module/webapp/webapp.module';
import { CouponModule } from './module/coupon/coupon.module';
import { BrokerModule } from '@common/broker/broker.module';
import { NotificationModule } from './module/notification/notification.module';
import { CalculateModule } from './module/calculate/calculate.module';
import { ConfigAppModule } from './module/config/config.module';
import { TemplateModule } from './module/template/template.module';
import { UserModule } from './module/user/user.module';
import { CheckingModule } from './module/checking/checking.module';
import { RedisCacheModule } from './module/cache/cache.module';
import { DeviceModule } from '@core/device/device.module';
import { BrowserModule } from './shared/browser/browser.module';
import { CourseModule } from './module/courses/courses.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            expandVariables: true,
        }),
        ScheduleModule.forRoot(),
        TelegrafModule.forRootAsync(getTelegramConfig()),
        BrokerModule,
        AuthModule,
        TelegramModule,
        UserModule,
        AccountModule,
        ProxyModule,
        HttpModule,
        OrderModule,
        ZennoModule,
        MirrorModule,
        BottModule,
        SharedModule,
        PaymentModule,
        CronModule,
        WebappModule,
        CouponModule,
        NotificationModule,
        CalculateModule,
        ConfigModule,
        ConfigAppModule,
        TemplateModule,
        CheckingModule,
        RedisCacheModule,
        DeviceModule,
        CourseModule,
    ],
})
export class AppModule {}
