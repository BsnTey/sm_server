import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChannelWrapper } from 'amqp-connection-manager';
import { RABBIT_MQ } from './broker.provider';
import { RABBIT_MQ_QUEUES } from '@common/broker/rabbitmq.queues';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { OrderTrackingWorker } from '../../module/notification/tracking/tracking.worker';
import { AccountShortInfoWorker } from './workers/account-short-info.worker';
import { PersonalDiscountInputWorker } from './workers/personal-discount-input.worker';
import { PersonalDiscountChunkWorker } from './workers/personal-discount-chunk.worker';
import { PersonalDiscountProductWorker } from './workers/personal-discount-product.worker';

@Injectable()
export class BrokerConsumer implements OnModuleInit {
    private readonly logger = new Logger(BrokerConsumer.name);

    constructor(
        @Inject(RABBIT_MQ) private readonly channel: ChannelWrapper,
        private readonly orderTrackingWorker: OrderTrackingWorker,
        private readonly accountShortInfoWorker: AccountShortInfoWorker,
        private readonly personalDiscountInputWorker: PersonalDiscountInputWorker,
        private readonly personalDiscountChunkWorker: PersonalDiscountChunkWorker,
        private readonly personalDiscountProductWorker: PersonalDiscountProductWorker,
    ) {}

    async onModuleInit() {
        await this.channel.addSetup(async (channel: ConfirmChannel) => {
            await this.registerHandlers(channel);
        });
    }

    private async registerHandlers(channel: ConfirmChannel) {
        // 1. Order Tracking
        await channel.consume(
            RABBIT_MQ_QUEUES.ORDERS_TRACKING_QUEUE,
            msg =>
                this.safeHandle('OrderTracking', msg, channel, RABBIT_MQ_QUEUES.ORDERS_TRACKING_QUEUE, 3, payload =>
                    this.orderTrackingWorker.process(payload),
                ),
            { noAck: false },
        );

        // 2. Account Short Info
        await channel.consume(
            RABBIT_MQ_QUEUES.ACCOUNT_SHORT_INFO_QUEUE,
            msg =>
                this.safeHandle('AccountShortInfo', msg, channel, RABBIT_MQ_QUEUES.ACCOUNT_SHORT_INFO_QUEUE, 3, payload =>
                    this.accountShortInfoWorker.process(payload),
                ),
            { noAck: false },
        );

        // 4. Personal Discount Chunk
        await channel.consume(
            RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_CHUNK_QUEUE,
            msg =>
                this.safeHandle('PersonalDiscountChunk', msg, channel, RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_CHUNK_QUEUE, 3, payload =>
                    this.personalDiscountChunkWorker.process(payload),
                ),
            { noAck: false },
        );

        // 5. Personal Discount Product
        await channel.consume(
            RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_PRODUCT_QUEUE,
            msg =>
                this.safeHandle('PersonalDiscountProduct', msg, channel, RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_PRODUCT_QUEUE, 3, payload =>
                    this.personalDiscountProductWorker.process(payload),
                ),
            { noAck: false },
        );

        await channel.prefetch(1);
        // 3. Personal Discount Input
        await channel.consume(
            RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_INPUT_QUEUE,
            msg =>
                this.safeHandle('PersonalDiscountInput', msg, channel, RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_INPUT_QUEUE, 3, payload =>
                    this.personalDiscountInputWorker.process(payload),
                ),
            { noAck: false },
        );
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
