import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { $Enums, OrderStatus } from '@prisma/client';
import { UserService } from '../user/user.service';
import { UpdatingPreferenceStatusRequestDto } from './dto/update-preference-status.dto';
import { OrderStatusTiming } from '../account/constants/order.constant';
import { StartOrderTrackingRequestDto } from './dto/start-order-tracking.dto';
import { TrackingStarterService } from './tracking/tracking.starter.service';
import { RedisCacheService } from '../cache/cache.service';
import { getPrefsUserByTelegramIdKey } from '../cache/cache.keys';

@Injectable()
export class NotificationPrefsService {
    private readonly logger = new Logger(NotificationPrefsService.name);
    private TTL_USER_PREFS = 60;

    constructor(
        private readonly users: UserService,
        private readonly starter: TrackingStarterService,
        private readonly cacheService: RedisCacheService,
    ) {}

    async getPreferences(tgId: string) {
        const user = await this.users.getUserByTelegramId(tgId);
        if (!user) throw new NotFoundException('User not found');

        const key = getPrefsUserByTelegramIdKey(tgId);
        const cachedPrefs = await this.cacheService.get<$Enums.OrderStatus[]>(key);
        if (cachedPrefs) {
            return cachedPrefs;
        }

        const enabled = new Set<OrderStatus>(await this.users.getNotificationPrefs(tgId));
        const codes = Object.values(OrderStatus) as OrderStatus[];

        const mapped = codes.map(code => ({
            statusLabel: code,
            statusName: OrderStatusTiming[code].label ?? code,
            active: enabled.has(code),
        }));
        await this.cacheService.set(key, mapped, this.TTL_USER_PREFS);
        return mapped;
    }

    async setPreferences(tgId: string, dto: UpdatingPreferenceStatusRequestDto) {
        const key = getPrefsUserByTelegramIdKey(tgId);
        await this.cacheService.del(key);
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
