import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AmqpConnectionManager } from 'amqp-connection-manager';
import { RABBIT_MQ_CONNECTION } from './broker.provider';
import { RABBIT_MQ_QUEUES, RABBIT_MQ_QUEUES_LIST } from '@common/broker/rabbitmq.queues';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { OrderTrackingWorker } from '../../module/notification/tracking/tracking.worker';
import { AccountShortInfoWorker } from './workers/account-short-info.worker';
import { PersonalDiscountInputWorker } from './workers/personal-discount-input.worker';
import { PersonalDiscountChunkWorker } from './workers/personal-discount-chunk.worker';
import { PersonalDiscountProductWorker } from './workers/personal-discount-product.worker';
import { MessagesToTelegramWorker } from './workers/messages-to-telegram.worker';
import { DELAYED_EXCHANGE, DELAYED_EXCHANGE_ARGS, DELAYED_EXCHANGE_TYPE } from '@common/broker/rabbitmq.constants';

@Injectable()
export class BrokerConsumer implements OnModuleInit {
    private readonly logger = new Logger(BrokerConsumer.name);

    constructor(
        @Inject(RABBIT_MQ_CONNECTION) private readonly connection: AmqpConnectionManager,
        private readonly orderTrackingWorker: OrderTrackingWorker,
        private readonly accountShortInfoWorker: AccountShortInfoWorker,
        private readonly personalDiscountInputWorker: PersonalDiscountInputWorker,
        private readonly personalDiscountChunkWorker: PersonalDiscountChunkWorker,
        private readonly personalDiscountProductWorker: PersonalDiscountProductWorker,
        private readonly messagesToTelegramWorker: MessagesToTelegramWorker,
    ) {}

    async onModuleInit() {
        const topologyChannel = this.connection.createChannel({
            setup: async (channel: ConfirmChannel) => {
                await channel.assertExchange(DELAYED_EXCHANGE, DELAYED_EXCHANGE_TYPE, {
                    durable: true,
                    arguments: DELAYED_EXCHANGE_ARGS,
                });

                for (const queue of RABBIT_MQ_QUEUES_LIST) {
                    await channel.assertQueue(queue, { durable: true });
                    await channel.bindQueue(queue, DELAYED_EXCHANGE, queue);
                }
                this.logger.log('✅ RabbitMQ: Топология настроена');
            },
        });
        await topologyChannel.waitForConnect();

        await this.setupInputConsumer(); // Prefetch 1
        await this.setupProductConsumer(); // Prefetch 2
        await this.setupDefaultConsumer(); // Prefetch 3
    }

    private async setupInputConsumer() {
        this.connection.createChannel({
            setup: async (channel: ConfirmChannel) => {
                await channel.prefetch(1);

                await channel.consume(
                    RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_INPUT_QUEUE,
                    msg =>
                        this.safeHandle('Input', msg, channel, RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_INPUT_QUEUE, 3, p =>
                            this.personalDiscountInputWorker.process(p),
                        ),
                    { noAck: false },
                );
                this.logger.log(`🎧 Consumer: Input запущен (Prefetch 1)`);
            },
        });
    }

    private async setupProductConsumer() {
        this.connection.createChannel({
            setup: async (channel: ConfirmChannel) => {
                await channel.prefetch(2);

                await channel.consume(
                    RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_PRODUCT_QUEUE,
                    msg =>
                        this.safeHandle('Product', msg, channel, RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_PRODUCT_QUEUE, 3, p =>
                            this.personalDiscountProductWorker.process(p),
                        ),
                    { noAck: false },
                );
                this.logger.log(`🎧 Consumer: Product запущен (Prefetch 2)`);
            },
        });
    }

    private async setupDefaultConsumer() {
        this.connection.createChannel({
            setup: async (channel: ConfirmChannel) => {
                await channel.prefetch(3);

                // Tracking
                await channel.consume(
                    RABBIT_MQ_QUEUES.ORDERS_TRACKING_QUEUE,
                    msg =>
                        this.safeHandle('Tracking', msg, channel, RABBIT_MQ_QUEUES.ORDERS_TRACKING_QUEUE, 3, p =>
                            this.orderTrackingWorker.process(p),
                        ),
                    { noAck: false },
                );

                // Chunk Worker
                await channel.consume(
                    RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_CHUNK_QUEUE,
                    msg =>
                        this.safeHandle('Chunk', msg, channel, RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_CHUNK_QUEUE, 3, p =>
                            this.personalDiscountChunkWorker.process(p),
                        ),
                    { noAck: false },
                );

                // Short Info
                await channel.consume(
                    RABBIT_MQ_QUEUES.ACCOUNT_SHORT_INFO_QUEUE,
                    msg =>
                        this.safeHandle('ShortInfo', msg, channel, RABBIT_MQ_QUEUES.ACCOUNT_SHORT_INFO_QUEUE, 3, p =>
                            this.accountShortInfoWorker.process(p),
                        ),
                    { noAck: false },
                );

                // Telegram Messages
                await channel.consume(
                    RABBIT_MQ_QUEUES.MESSAGES_TO_TELEGRAM_QUEUE,
                    msg =>
                        this.safeHandle('TgMsg', msg, channel, RABBIT_MQ_QUEUES.MESSAGES_TO_TELEGRAM_QUEUE, 3, p =>
                            this.messagesToTelegramWorker.process(p),
                        ),
                    { noAck: false },
                );
            },
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
                this.logger.error(`${label}: failed to ack success`, ackErr);
            }
        } catch (e) {
            const headers = msg.properties.headers || {};
            const currentRetry = (headers['x-retry-count'] as number) || 0;
            const attempt = currentRetry + 1;

            if (attempt < maxAttempts) {
                const delayMs = attempt * 5000;

                this.logger.warn(
                    `${label} failed (attempt ${attempt}/${maxAttempts}). Retry in ${delayMs}ms. Error: ${e instanceof Error ? e.message : e}`,
                );

                try {
                    const newHeaders = { ...headers, 'x-retry-count': attempt, 'x-delay': delayMs };

                    raw.publish(DELAYED_EXCHANGE, queueName, msg.content, {
                        headers: newHeaders,
                        persistent: msg.properties.deliveryMode === 2,
                    });

                    raw.ack(msg);
                    return;
                } catch (publishErr) {
                    this.logger.error(`${label}: failed to republish retry message`, publishErr);
                }
            }

            this.logger.error(`${label} failed completely. Giving up.`, e);
            try {
                raw.ack(msg);
            } catch (ackErr) {
                this.logger.error(`${label}: failed to ack after error (channel probably closed)`, ackErr);
            }
        }
    }
}
