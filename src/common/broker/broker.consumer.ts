import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChannelWrapper } from 'amqp-connection-manager';
import { RABBIT_MQ } from './broker.provider';
import { RABBIT_MQ_QUEUES } from '@common/broker/rabbitmq.queues';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { OrderTrackingWorker } from '../../module/notification/tracking/tracking.worker';
import { PersonalDiscountWorker } from './workers/personal-discount.worker';
import { AccountShortInfoWorker } from './workers/account-short-info.worker';

@Injectable()
export class BrokerConsumer implements OnModuleInit {
    private readonly logger = new Logger(BrokerConsumer.name);

    constructor(
        @Inject(RABBIT_MQ) private readonly channel: ChannelWrapper,
        private readonly worker: OrderTrackingWorker,
        private readonly personalDiscountWorker: PersonalDiscountWorker,
        private readonly accountShortInfoWorker: AccountShortInfoWorker,
    ) {}

    async onModuleInit() {
        await this.registerHandlers();
    }

    private async registerHandlers() {
        await this.channel.addSetup(async (raw: ConfirmChannel) => {
            await raw.consume(
                RABBIT_MQ_QUEUES.ORDERS_TRACKING_QUEUE,
                msg => this.safeHandle('OrderTrackingWorker', msg, raw, payload => this.worker.process(payload)),
                { noAck: false },
            );

            await raw.consume(
                RABBIT_MQ_QUEUES.PERSONAL_DISCOUNT_QUEUE,
                msg => this.safeHandle('PersonalDiscountWorker', msg, raw, payload => this.personalDiscountWorker.process(payload)),
                { noAck: false },
            );

            await raw.consume(
                RABBIT_MQ_QUEUES.ACCOUNT_SHORT_INFO_QUEUE,
                msg => this.safeHandle('AccountShortInfoWorker', msg, raw, payload => this.accountShortInfoWorker.process(payload)),
                { noAck: false },
            );
        });
    }

    private async safeHandle(label: string, msg: ConsumeMessage | null, raw: ConfirmChannel, handler: (payload: Buffer) => Promise<void>) {
        if (!msg) return;
        try {
            await handler(msg.content);
            raw.ack(msg);
        } catch (e) {
            this.logger.error(`${label} failed, ack anyway (no retries here):`, e);
            raw.ack(msg);
        }
    }
}
