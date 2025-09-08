import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { UserService } from '../user/user.service';
import { UpdatingPreferenceStatusRequestDto } from './dto/update-preference-status.dto';
import { OrderStatusTiming } from '../account/constants/order.constant';
import { StartOrderTrackingRequestDto } from './dto/start-order-tracking.dto';
import { TrackingStarterService } from './tracking/tracking.starter.service';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private readonly users: UserService,
        private readonly starter: TrackingStarterService,
    ) {}

    async getPreferences(tgId: string) {
        const user = await this.users.getUserByTelegramId(tgId);
        if (!user) throw new NotFoundException('User not found');

        const enabled = new Set<OrderStatus>(await this.users.getNotificationPrefs(tgId));
        const codes = Object.values(OrderStatus) as OrderStatus[];

        return codes.map(code => ({
            statusLabel: code,
            statusName: OrderStatusTiming[code].label ?? code,
            active: enabled.has(code),
        }));
    }

    async setPreferences(tgId: string, dto: UpdatingPreferenceStatusRequestDto) {
        const user = await this.users.getUserByTelegramId(tgId);
        if (!user) throw new NotFoundException('User not found');

        this.logger.log(
            `Пользователь ${user.telegramName} - ${user.telegramId}, выставил предпочтения для отслеживания ${dto.status.join(' ')}`,
        );

        const allStatuses = new Set(Object.values(OrderStatus));

        const enabled = Array.from(dto.status.filter(i => allStatuses.has(i)));

        await this.users.setNotificationPrefs(tgId, enabled);

        return this.getPreferences(tgId);
    }

    async startTracking(dto: StartOrderTrackingRequestDto) {
        return this.starter.start(dto);
    }
}
