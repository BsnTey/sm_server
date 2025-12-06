import { Injectable, Logger } from '@nestjs/common';
import { AccountService } from '../../account/account.service';
import { UserService } from '../../user/user.service';
import { TelegramService } from '../../telegram/telegram.service';
import { DelayedPublisher } from '@common/broker/delayed.publisher';
import { RABBIT_MQ_QUEUES } from '@common/broker/rabbitmq.queues';
import { TrackOrderJob } from './tracking.types';
import { OrderStatus } from '@prisma/client';
import { LabelToOrderStatus, OrderStatusTiming, nextDelayMs } from '../../account/constants/order.constant';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrderTrackingWorker {
    private readonly logger = new Logger(OrderTrackingWorker.name);
    private urlSite = this.configService.getOrThrow('API_DONOR_SITE');

    constructor(
        private readonly accountService: AccountService,
        private readonly users: UserService,
        private readonly publisher: DelayedPublisher,
        private readonly telegram: TelegramService,
        private configService: ConfigService,
    ) {}

    private parseStatus(resp: any): { code?: OrderStatus; label?: string } {
        // API возвращает: data.order.status.statusText (RU) и status (машинный)
        const rawLabel: string | undefined = resp?.data?.order?.status?.statusText;
        const label = typeof rawLabel === 'string' ? rawLabel.trim() : undefined;

        if (label && LabelToOrderStatus[label]) {
            return { code: LabelToOrderStatus[label], label };
        }

        // Фоллбек: попробуем историю статусов — последний элемент
        const hist = resp?.data?.order?.statusHistory;
        if (Array.isArray(hist) && hist.length) {
            const last = hist[hist.length - 1];
            const lbl = (last?.statusText || '').trim();
            if (lbl && LabelToOrderStatus[lbl]) return { code: LabelToOrderStatus[lbl], label: lbl };
        }

        return { code: undefined, label };
    }

    private formatThanksLink(orderNumber: string): string {
        return `${this.urlSite}cart/thanks/${orderNumber}/`;
    }

    private formatStatusText(orderNumber: string, status: OrderStatus, label?: string) {
        const name = OrderStatusTiming[status]?.label || label || status;
        return `Статус заказа ${orderNumber}: ${name}`;
    }

    private async notifyError(telegramId: number, orderNumber: string) {
        const link = this.formatThanksLink(orderNumber);
        const text = [`Не удалось отследить статус заказа ${orderNumber}.`, `Вы можете проверить вручную: ${link}`].join('\n');
        await this.telegram.sendMessage(telegramId, text);
    }

    private async notifyStatusIfAllowed(telegramId: number, status: OrderStatus, orderNumber: string, label?: string) {
        const prefs = new Set(await this.users.getNotificationPrefs(telegramId.toString()));
        if (!prefs.has(status)) return;

        const text = this.formatStatusText(orderNumber, status, label);
        await this.telegram.sendMessage(telegramId, text);
    }

    private isTerminal(status: OrderStatus): boolean {
        const strat = OrderStatusTiming[status]?.strategy;
        return strat?.kind === 'terminal';
    }

    async process(buf: Buffer) {
        const job: TrackOrderJob = JSON.parse(buf.toString('utf8'));
        const { telegramId, orderNumber, accountId } = job;

        // 1) тянем статус
        let resp: any;
        try {
            resp = await this.accountService.orderInfo(accountId, orderNumber);
        } catch (e) {
            // ошибка апи — сообщаем и выходим без репаблиша
            await this.notifyError(+telegramId, orderNumber);
            this.logger.warn(`orderInfo failed for ${orderNumber}`);
            return;
        }

        // 2) парсим статус
        const { code: current, label } = this.parseStatus(resp);
        if (!current) {
            // статус непонятен — будем пробовать позже фиксированной задержкой 10 минут
            const delayMs = 10 * 60_000;
            const next: TrackOrderJob = {
                ...job,
                lastCheckedAt: new Date().toISOString(),
                lastStatus: job.lastStatus, // не меняем
                lastStatusLabel: label || job.lastStatusLabel,
            };
            await this.publisher.publish(RABBIT_MQ_QUEUES.ORDERS_TRACKING_QUEUE, next, delayMs);
            return;
        }

        // 3) изменился ли статус
        const changed = !job.lastStatus || job.lastStatus !== current;

        if (changed) {
            // отправим, если пользователь такой статус включил
            await this.notifyStatusIfAllowed(+telegramId, current, orderNumber, label);
        }

        // 4) терминальный?
        if (this.isTerminal(current)) {
            // завершаем: не репаблишим
            this.logger.log(`Order ${orderNumber} reached terminal status ${current}, stop tracking.`);
            await this.scheduleAccountShortInfo(accountId);
            return;
        }

        // 5) считаем задержку на следующую проверку
        const nextMs = nextDelayMs(current, job.progressiveDelayMs);
        if (nextMs == null) {
            // на всякий случай
            return;
        }

        // 6) планируем следующую проверку
        const nextJob: TrackOrderJob = {
            ...job,
            lastStatus: current,
            lastStatusLabel: label,
            lastCheckedAt: new Date().toISOString(),
            progressiveDelayMs: OrderStatusTiming[current]?.strategy?.kind === 'progressive' ? nextMs : undefined,
        };

        await this.publisher.publish(RABBIT_MQ_QUEUES.ORDERS_TRACKING_QUEUE, nextJob, nextMs);
    }

    private async scheduleAccountShortInfo(accountId: string) {
        const delayMs = this.delayUntilNextDayAtThreeAM();
        await this.publisher.publish(RABBIT_MQ_QUEUES.ACCOUNT_SHORT_INFO_QUEUE, { accountId }, delayMs);
        this.logger.log(`Scheduled account short info for ${accountId} in ${(delayMs / 3600000).toFixed(2)}h`);
    }

    private delayUntilNextDayAtThreeAM(): number {
        const now = new Date();
        const target = new Date(now);
        target.setDate(target.getDate() + 1);
        target.setHours(4, 0, 0, 0);
        return Math.max(0, target.getTime() - now.getTime());
    }
}
