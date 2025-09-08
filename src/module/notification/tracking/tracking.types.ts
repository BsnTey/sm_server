import { OrderStatus } from '@prisma/client';

export type TrackOrderJob = {
    telegramId: string;
    orderNumber: string;
    accountId: string;

    lastStatus?: OrderStatus;
    lastStatusLabel?: string;
    lastCheckedAt?: string;

    progressiveDelayMs?: number;
    createdAt: string;
};
