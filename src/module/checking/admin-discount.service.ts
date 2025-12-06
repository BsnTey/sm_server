import { Injectable, Logger } from '@nestjs/common';
import { AccountDiscountService } from './account-discount.service';
import { CheckingService } from './checking.service';
import { RedisCacheService } from '../cache/cache.service';
import { DelayedPublisher } from '@common/broker/delayed.publisher';
import { RABBIT_MQ_QUEUES } from '@common/broker/rabbitmq.queues';

@Injectable()
export class AdminDiscountService {
    private readonly logger = new Logger(AdminDiscountService.name);

    constructor(
        private readonly accountDiscountService: AccountDiscountService,
        private readonly checkingService: CheckingService,
        private readonly cacheService: RedisCacheService,
        private readonly publisher: DelayedPublisher,
    ) {}

    /**
     * Полная очистка всех таблиц скидок + кеш Redis
     */
    async fullCleanup(): Promise<{ ok: boolean; message: string }> {
        this.logger.log('[Admin] Starting full cleanup of discount data');

        // 1. Очистка всех таблиц БД
        await this.accountDiscountService.fullCleanupAllDiscountData();

        // 2. Очистка кеша Redis
        await this.cacheService.clearDiscountRelatedCache();

        this.logger.log(`[Admin] Full cleanup completed. Deleted records`);

        return {
            ok: true,
            message: 'Все таблицы скидок и кеш очищены',
        };
    }

    /**
     * Обновление данных: сохранить аккаунты, очистить всё, заново загрузить
     */
    async refreshAllDiscountData(): Promise<{
        ok: boolean;
        message: string;
        usersProcessed: number;
        details?: { telegramId: string; accountsCount: number; estimatedSeconds: number }[];
    }> {
        this.logger.log('[Admin] Starting refresh of all discount data');

        // 1. Получаем все аккаунты сгруппированные по telegramId ДО очистки
        const accountsByTelegram = await this.accountDiscountService.findAllAccountsGroupedByTelegram();
        const telegramIds = Array.from(accountsByTelegram.keys());

        if (!telegramIds.length) {
            return {
                ok: true,
                message: 'Нет данных для обновления',
                usersProcessed: 0,
            };
        }

        // 2. Уведомляем пользователей о начале обновления через брокер
        for (const telegramId of telegramIds) {
            await this.notifyUserViaBroker(telegramId, '🔄 Начинается обновление данных "Моя скидка". Это может занять некоторое время.');
        }

        // 3. Полная очистка БД и кеша
        await this.accountDiscountService.fullCleanupAllDiscountData();
        await this.cacheService.clearDiscountRelatedCache();

        // 4. Заново запускаем обработку для каждого пользователя
        const results: { telegramId: string; accountsCount: number; estimatedSeconds: number }[] = [];

        for (const [telegramId, accountIds] of accountsByTelegram) {
            try {
                const result = await this.checkingService.queueAccountsForPersonalDiscountV1({
                    telegramId,
                    personalDiscounts: accountIds,
                });

                results.push({
                    telegramId,
                    accountsCount: accountIds.length,
                    estimatedSeconds: result.estimatedSeconds,
                });

                this.logger.log(`[Admin] Queued ${accountIds.length} accounts for telegramId=${telegramId}`);
            } catch (e) {
                this.logger.error(`[Admin] Failed to queue accounts for telegramId=${telegramId}`, e);
            }
        }

        this.logger.log(`[Admin] Refresh completed for ${results.length} users`);

        return {
            ok: true,
            message: 'Обновление запущено для всех пользователей',
            usersProcessed: results.length,
            details: results,
        };
    }

    /**
     * Отправить сообщение пользователю через брокер
     */
    private async notifyUserViaBroker(telegramId: string, message: string): Promise<void> {
        try {
            await this.publisher.publish(RABBIT_MQ_QUEUES.MESSAGES_TO_TELEGRAM_QUEUE, { telegramId: Number(telegramId), message }, 0);
        } catch (e) {
            this.logger.warn(`Failed to queue notification for user ${telegramId}`);
        }
    }
}
