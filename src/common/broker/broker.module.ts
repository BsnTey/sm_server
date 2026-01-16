import { forwardRef, Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ChannelWrapper } from 'amqp-connection-manager';
import { BrokerConsumer } from './broker.consumer';
import { brokerProvider, RABBIT_MQ, rabbitChannelProvider } from './broker.provider';
import { ConfigModule } from '@nestjs/config';
import { DelayedPublisher } from '@common/broker/delayed.publisher';
import { AccountModule } from '../../module/account/account.module';
import { AccountShortInfoWorker } from './workers/account-short-info.worker';
import { PersonalDiscountInputWorker } from './workers/personal-discount-input.worker';
import { CheckingModule } from '../../module/checking/checking.module';
import { PersonalDiscountChunkWorker } from './workers/personal-discount-chunk.worker';
import { PersonalDiscountProductWorker } from './workers/personal-discount-product.worker';
import { MessagesToTelegramWorker } from './workers/messages-to-telegram.worker';
import { TelegramModule } from '../../module/telegram/telegram.module';
import { NotificationPrefsModule } from '../../module/notificationPrefs/notificationPrefs.module';

@Global()
@Module({
    imports: [ConfigModule, forwardRef(() => NotificationPrefsModule), AccountModule, CheckingModule, TelegramModule],
    providers: [
        brokerProvider,
        rabbitChannelProvider,
        BrokerConsumer,
        DelayedPublisher,
        AccountShortInfoWorker,
        PersonalDiscountInputWorker,
        PersonalDiscountChunkWorker,
        PersonalDiscountProductWorker,
        MessagesToTelegramWorker,
    ],
    exports: [brokerProvider, DelayedPublisher, rabbitChannelProvider],
})
export class BrokerModule implements OnApplicationShutdown {
    @Inject(RABBIT_MQ)
    private readonly channel: ChannelWrapper;

    async onApplicationShutdown() {
        await this.channel.close();
    }
}
