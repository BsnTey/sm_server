import { OrderStatus } from '@prisma/client';

type DelayStrategy =
    | { kind: 'fixed'; minutes: number }
    | { kind: 'progressive'; start: number; factor: number; max: number }
    | { kind: 'terminal' };

type StatusTimingMeta = {
    label: string;
    strategy: DelayStrategy;
};

export const OrderStatusTiming: Record<OrderStatus, StatusTimingMeta> = {
    // === быстрые статусы самовывоза (1 мин) ===
    [OrderStatus.accepted]: { label: 'Создан', strategy: { kind: 'fixed', minutes: 1 } },
    [OrderStatus.check_availability]: { label: 'Проверка наличия', strategy: { kind: 'fixed', minutes: 1 } },
    [OrderStatus.availability_confirmed]: { label: 'Наличие подтверждено', strategy: { kind: 'fixed', minutes: 1 } },
    [OrderStatus.completing]: { label: 'Комплектуется', strategy: { kind: 'fixed', minutes: 0.3 } },

    // === особый: прогрессивный backoff (1m → 2m → 4m ... cap 60m) ===
    [OrderStatus.ready_to_issue]: {
        label: 'Готов к выдаче',
        strategy: { kind: 'progressive', start: 1, factor: 2, max: 60 },
    },

    // === терминальные (0) — больше не проверяем ===
    [OrderStatus.issued]: { label: 'Получен', strategy: { kind: 'terminal' } },
    [OrderStatus.ord_full_delivered]: { label: 'Получен', strategy: { kind: 'terminal' } },
    [OrderStatus.delivered]: { label: 'Доставлен', strategy: { kind: 'terminal' } },
    [OrderStatus.cancelled]: { label: 'Отменён', strategy: { kind: 'terminal' } },

    // === доставка — редкие проверки ===
    [OrderStatus.accepted_in_work]: { label: 'Принят в работу', strategy: { kind: 'fixed', minutes: 60 } },
    [OrderStatus.ord_sent_to_cc]: { label: 'Передан в службу доставки', strategy: { kind: 'fixed', minutes: 60 } },
    [OrderStatus.ord_accepted_to_cc]: { label: 'Подготовлен к отправке', strategy: { kind: 'fixed', minutes: 60 } },
    [OrderStatus.ord_sent_to_delivery_region]: {
        label: 'Отправлен в ваш город',
        strategy: { kind: 'fixed', minutes: 120 },
    },
    [OrderStatus.arrived_to_region_and_awaiting_delivery]: {
        label: 'Прибыл в ваш город',
        strategy: { kind: 'fixed', minutes: 60 },
    },
    [OrderStatus.transfered_for_delivery]: { label: 'Передан курьеру', strategy: { kind: 'fixed', minutes: 60 } },
    [OrderStatus.at_pickup]: { label: 'Поступил в ПВЗ', strategy: { kind: 'fixed', minutes: 60 } },
};

export const LabelToOrderStatus: Record<string, OrderStatus> = Object.entries(OrderStatusTiming).reduce(
    (acc, [key, val]) => {
        acc[val.label] = key as OrderStatus;
        return acc;
    },
    {} as Record<string, OrderStatus>,
);

export function nextDelayMs(status: OrderStatus, prevProgressiveMs?: number): number | null {
    const meta = OrderStatusTiming[status];
    if (!meta) return 60_000; // дефолт минута
    if (meta.strategy.kind === 'terminal') return null;
    if (meta.strategy.kind === 'fixed') return meta.strategy.minutes * 60_000;

    // progressive
    const base = typeof prevProgressiveMs === 'number' && prevProgressiveMs > 0 ? prevProgressiveMs : meta.strategy.start * 60_000;

    return Math.min(base * meta.strategy.factor, meta.strategy.max * 60_000);
}
