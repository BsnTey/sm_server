import { forwardRef, Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { UserModule } from '../user/user.module';
import { TrackingStarterService } from './tracking/tracking.starter.service';
import { OrderTrackingWorker } from './tracking/tracking.worker';
import { DelayedPublisher } from '@common/broker/delayed.publisher';
import { BrokerModule } from '@common/broker/broker.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AccountModule } from '../account/account.module';

@Module({
    imports: [UserModule, AccountModule, TelegramModule, forwardRef(() => BrokerModule)],
    controllers: [NotificationController],
    providers: [NotificationService, TrackingStarterService, OrderTrackingWorker, DelayedPublisher],
    exports: [NotificationService, OrderTrackingWorker],
})
export class NotificationModule {}
