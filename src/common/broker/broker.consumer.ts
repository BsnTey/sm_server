import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChannelWrapper } from 'amqp-connection-manager';
import { RABBIT_MQ } from './broker.provider';
import { RABBIT_MQ_QUEUES } from '@common/broker/rabbitmq.queues';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { OrderTrackingWorker } from '../../module/notification/tracking/tracking.worker';
import { PersonalDiscountWorker } from './workers/personal-discount.worker';
import { AccountShortInfoWorker } from './workers/account-short-info.worker';
import { PersonalDiscountInputWorker } from './workers/personal-discount-input.worker';

@Injectable()
export class BrokerConsumer implements OnModuleInit {
    private readonly logger = new Logger(BrokerConsumer.name);

    constructor(
        @Inject(RABBIT_MQ) private readonly channel: ChannelWrapper,
        private readonly worker: OrderTrackingWorker,
        private readonly personalDiscountWorker: PersonalDiscountWorker,
        private readonly accountShortInfoWorker: AccountShortInfoWorker,
        private readonly personalDiscountV1Worker: PersonalDiscountInputWorker,
    ) {}

    async onModuleInit() {
        await this.registerHandlers();
    }

    private async registerHandlers() {
        await this.channel.addSetup(async (raw: ConfirmChannel) => {
            await raw.prefetch(3);

            await raw.consume(
                RABBIT_MQ_QUEUES.ORDERS_TRACKING_QUEUE,
                msg =>
                    this.safeHandle(
                        'OrderTrackingWorker',
                        msg,
                        raw,
                        RABBIT_MQ_QUEUES.ORDERS_TRACKING_QUEUE,
                        1, // maxAttempts
                        payload => this.worker.process(payload),
                    ),
                { noAck: false },
            );

            await raw.consume(
                RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_QUEUE,
                msg =>
                    this.safeHandle(
                        'PersonalDiscountWorker',
                        msg,
                        raw,
                        RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_QUEUE,
                        3, // maxAttempts
                        payload => this.personalDiscountWorker.process(payload),
                    ),
                { noAck: false },
            );

            await raw.consume(
                RABBIT_MQ_QUEUES.ACCOUNT_SHORT_INFO_QUEUE,
                msg =>
                    this.safeHandle(
                        'AccountShortInfoWorker',
                        msg,
                        raw,
                        RABBIT_MQ_QUEUES.ACCOUNT_SHORT_INFO_QUEUE,
                        1, // maxAttempts
                        payload => this.accountShortInfoWorker.process(payload),
                    ),
                { noAck: false },
            );

            await raw.prefetch(1);

            await raw.consume(
                RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_INPUT_QUEUE,
                msg =>
                    this.safeHandle(
                        'PersonalDiscountV1Worker',
                        msg,
                        raw,
                        RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_INPUT_QUEUE,
                        3, // maxAttempts
                        payload => this.personalDiscountV1Worker.process(payload),
                    ),
                { noAck: false },
            );
        });
    }

    private async safeHandle(
        label: string,
        msg: ConsumeMessage | null,
        raw: ConfirmChannel,
        queueName: string,
        maxAttempts: number,
        handler: (payload: Buffer) => Promise<void>,
    ) {
        if (!msg) return;

        try {
            await handler(msg.content);
            try {
                raw.ack(msg);
            } catch (ackErr) {
                this.logger.error(`${label}: failed to ack success (channel probably closed)`, ackErr);
            }
        } catch (e) {
            const headers = msg.properties.headers || {};
            const currentRetry = (headers['x-retry-count'] as number) || 0;
            const attempt = currentRetry + 1;

            if (attempt < maxAttempts) {
                this.logger.warn(
                    `${label} failed (attempt ${attempt}/${maxAttempts}). Retrying... Error: ${e instanceof Error ? e.message : e}`,
                );

                try {
                    // 1. Отправляем сообщение заново в конец очереди с обновленным счетчиком
                    const newHeaders = { ...headers, 'x-retry-count': attempt };

                    raw.sendToQueue(queueName, msg.content, {
                        headers: newHeaders,
                        persistent: msg.properties.deliveryMode === 2,
                    });
                    raw.ack(msg);
                    return;
                } catch (publishErr) {
                    this.logger.error(`${label}: failed to republish retry message`, publishErr);
                }
            }

            // Если попыток не осталось или переопубликация упала
            this.logger.error(`${label} failed completely after ${attempt} attempt(s). Giving up. Error:`, e);
            try {
                raw.ack(msg);
            } catch (ackErr) {
                this.logger.error(`${label}: failed to ack after error (channel probably closed)`, ackErr);
            }
        }
    }
}
