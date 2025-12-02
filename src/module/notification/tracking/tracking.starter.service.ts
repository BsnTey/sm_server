import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DelayedPublisher } from '@common/broker/delayed.publisher';
import { RABBIT_MQ_QUEUES } from '@common/broker/rabbitmq.queues';
import { StartOrderTrackingRequestDto } from '../dto/start-order-tracking.dto';
import { UserService } from '../../user/user.service';
import { TrackOrderJob } from './tracking.types';
import { AccountService } from '../../account/account.service';
import { OrderService } from '../../order/order.service';

@Injectable()
export class TrackingStarterService {
    private readonly logger = new Logger(TrackingStarterService.name);

    constructor(
        private readonly publisher: DelayedPublisher,
        private readonly accounts: AccountService,
        private readonly orderService: OrderService,
        private readonly users: UserService,
    ) {}

    async start(dto: StartOrderTrackingRequestDto) {
        const user = await this.users.getUserByTelegramId(dto.telegramId);
        if (!user) throw new NotFoundException('User not found');

        await this.accounts.shortInfo(dto.accountId);
        this.logger.log(`Старт отслеживания для заказа ${dto.orderNumber}, у ${user.telegramName} - ${dto.telegramId}`);

        const job: TrackOrderJob = {
            telegramId: dto.telegramId,
            orderNumber: dto.orderNumber,
            accountId: dto.accountId,
            createdAt: new Date().toISOString(),
        };

        // первая проверка—через 5 секунд
        await this.publisher.publish(RABBIT_MQ_QUEUES.ORDERS_TRACKING_QUEUE, job, 5_000);
        await this.orderService.orderHistory(dto.accountId);

        return { accepted: true };
    }
}
