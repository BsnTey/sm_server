import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChannelWrapper } from 'amqp-connection-manager';
import { RABBIT_MQ } from './broker.provider';
import { RABBIT_MQ_QUEUES } from '@common/broker/rabbitmq.queues';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { OrderTrackingWorker } from '../../module/notification/tracking/tracking.worker';

@Injectable()
export class BrokerConsumer implements OnModuleInit {
    private readonly logger = new Logger(BrokerConsumer.name);

    constructor(
        @Inject(RABBIT_MQ) private readonly channel: ChannelWrapper,
        private readonly worker: OrderTrackingWorker,
    ) {}

    async onModuleInit() {
        await this.registerHandlers();
    }

    private async registerHandlers() {
        await this.channel.addSetup(async (raw: ConfirmChannel) => {
            await raw.consume(RABBIT_MQ_QUEUES.ORDERS_TRACKING_QUEUE, msg => this.safeHandle(msg, raw), { noAck: false });
        });
    }

    private async safeHandle(msg: ConsumeMessage | null, raw: ConfirmChannel) {
        if (!msg) return;
        try {
            await this.worker.process(msg.content);
            raw.ack(msg);
        } catch (e) {
            this.logger.error('OrderTrackingWorker failed, ack anyway (no retries here):', e);
            raw.ack(msg);
        }
    }
}
