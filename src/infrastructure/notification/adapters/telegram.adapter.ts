import { Injectable, Logger } from '@nestjs/common';
import { RABBIT_MQ_QUEUES } from '@common/broker/rabbitmq.queues';
import { DelayedPublisher } from '@common/broker/delayed.publisher';
import { ConfigService } from '@nestjs/config';
import { INotificationPort } from '@core/ports/notification.port';

@Injectable()
export class TelegramNotificationAdapter implements INotificationPort {
    private readonly logger = new Logger(TelegramNotificationAdapter.name);
    private readonly adminId: number;

    constructor(
        private configService: ConfigService,
        private readonly publisher: DelayedPublisher,
    ) {
        this.adminId = Number(this.configService.getOrThrow('TELEGRAM_ADMIN_ID').split(',')[0]);
    }

    async notifyUser(telegramId: string | number, message: string): Promise<void> {
        await this.publisher.publish(
            RABBIT_MQ_QUEUES.MESSAGES_TO_TELEGRAM_QUEUE,
            {
                telegramId: Number(telegramId),
                message,
            },
            0,
        );
    }

    async notifyAdmin(message: string): Promise<void> {
        await this.publisher.publish(
            RABBIT_MQ_QUEUES.MESSAGES_TO_TELEGRAM_QUEUE,
            {
                telegramId: this.adminId,
                message,
            },
            0,
        );
    }
}
