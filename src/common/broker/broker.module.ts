import { forwardRef, Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ChannelWrapper } from 'amqp-connection-manager';
import { BrokerConsumer } from './broker.consumer';
import { brokerProvider, RABBIT_MQ } from './broker.provider';
import { ConfigModule } from '@nestjs/config';
import { DelayedPublisher } from '@common/broker/delayed.publisher';
import { NotificationModule } from '../../module/notification/notification.module';

@Global()
@Module({
    imports: [ConfigModule, forwardRef(() => NotificationModule)],
    providers: [brokerProvider, BrokerConsumer, DelayedPublisher],
    exports: [brokerProvider, DelayedPublisher],
})
export class BrokerModule implements OnApplicationShutdown {
    @Inject(RABBIT_MQ)
    private readonly channel: ChannelWrapper;

    async onApplicationShutdown() {
        await this.channel.close();
    }
}
