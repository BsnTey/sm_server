import { forwardRef, Module } from '@nestjs/common';
import { NotificationPrefsController } from './notificationPrefs.controller';
import { NotificationPrefsService } from './notificationPrefs.service';
import { UserModule } from '../user/user.module';
import { TrackingStarterService } from './tracking/tracking.starter.service';
import { OrderTrackingWorker } from './tracking/tracking.worker';
import { DelayedPublisher } from '@common/broker/delayed.publisher';
import { BrokerModule } from '@common/broker/broker.module';
import { AccountModule } from '../account/account.module';
import { OrderModule } from '../order/order.module';

@Module({
    imports: [UserModule, AccountModule, OrderModule, forwardRef(() => BrokerModule)],
    controllers: [NotificationPrefsController],
    providers: [NotificationPrefsService, TrackingStarterService, OrderTrackingWorker, DelayedPublisher],
    exports: [NotificationPrefsService, OrderTrackingWorker],
})
export class NotificationPrefsModule {}
