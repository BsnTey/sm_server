import { Prisma } from '@prisma/client';

export interface PurchaseByAccountIdResult {
    buyerTelegramId: string;
    purchasedAt: Date;
}

export interface CreatePurchaseAccount {
    id: string;
    orderNumber: string;
    lineIndex: number;
    accountId: string;
    buyerTelegramId: string;
    amount: number;
    purchasedAt?: Date;
    rawPayload: Prisma.InputJsonValue;
}
