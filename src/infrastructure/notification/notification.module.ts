import { Global, Module } from '@nestjs/common';
import { TelegramNotificationAdapter } from './adapters/telegram.adapter';
import { INotificationPort } from '@core/ports/notification.port';

@Global()
@Module({
    imports: [],
    providers: [
        {
            provide: INotificationPort,
            useClass: TelegramNotificationAdapter,
        },
    ],
    exports: [INotificationPort],
})
export class NotificationModule {}
