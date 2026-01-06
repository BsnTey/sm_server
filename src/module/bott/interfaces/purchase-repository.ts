import { Prisma } from '@prisma/client';

export interface PurchaseByAccountIdResult {
    id: string;
    buyerTelegramId: string;
    purchasedAt: Date;
    hasPromoCode: boolean;
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
    hasPromoCode: boolean;
}

export interface ParsedOrder {
    orderId: string;
    buyerTelegramId: string;
    purchasedAt: Date;
    items: Array<{ accountId: string; hasPromoCode: boolean; rawLine: string }>;
    rawProductData: string;
    totalAmount: number;
}
