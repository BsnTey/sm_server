import { Inject, Injectable } from '@nestjs/common';
import { ChannelWrapper } from 'amqp-connection-manager';
import { RABBIT_MQ } from './broker.provider';
import { DELAYED_EXCHANGE } from './rabbitmq.constants';

@Injectable()
export class DelayedPublisher {
    constructor(@Inject(RABBIT_MQ) private readonly channel: ChannelWrapper) {}

    async publish<T>(routingKey: string, message: T, delayMs: number) {
        const payload = Buffer.from(JSON.stringify(message));
        await this.channel.publish(DELAYED_EXCHANGE, routingKey, payload, {
            persistent: true,
            headers: { 'x-delay': Math.max(0, Math.floor(delayMs)) },
            contentType: 'application/json',
        });
    }
}
