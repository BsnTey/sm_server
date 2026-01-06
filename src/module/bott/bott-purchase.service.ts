import { Injectable, Logger } from '@nestjs/common';
import { BottPurchaseRepository } from './bott-purchase.repository';
import { CreatePurchaseAccount } from './interfaces/purchase-repository';

@Injectable()
export class BottPurchaseService {
    private readonly logger = new Logger(BottPurchaseService.name);

    constructor(private readonly purchaseRepo: BottPurchaseRepository) {}

    async createPurchase(data: CreatePurchaseAccount) {
        return this.purchaseRepo.create(data);
    }

    async getPurchaseByAccountId(accountId: string) {
        return this.purchaseRepo.getByAccountId(accountId);
    }

    async getLastPurchaseByAccountId(accountId: string) {
        const lastPurchase = await this.getPurchaseByAccountId(accountId);
        if (lastPurchase.length == 0) return null;
        return lastPurchase[lastPurchase.length - 1];
    }

    async updatePurchase(id: string, purchasedAt: Date, hasPromoCode: boolean) {
        return this.purchaseRepo.updatePaidStatusPurchase(id, { purchasedAt, hasPromoCode });
    }

    async createFakePurchase(accountId: string, buyerTelegramId: string) {
        const now = new Date();

        // Генерируем уникальный ID покупки
        const fakeId = now.getTime().toString().slice(-8);

        // Генерируем номер заказа, чтобы было понятно, что он фейковый
        const fakeOrderNumber = `${now.getTime()}-FAKE`;

        const dto: CreatePurchaseAccount = {
            id: fakeId,
            orderNumber: fakeOrderNumber,
            lineIndex: 1,
            accountId: accountId,
            buyerTelegramId: buyerTelegramId,
            amount: 0,
            purchasedAt: now,
            hasPromoCode: false,
            rawPayload: {
                status: 'FAKE_FALLBACK',
                reason: 'Order not found in search history',
                created_by: 'System',
                timestamp: now.toISOString(),
            },
        };

        try {
            this.logger.warn(`Created FAKE purchase for account ${accountId} (User: ${buyerTelegramId})`);
            return this.purchaseRepo.create(dto);
        } catch (e: any) {
            this.logger.error(`Failed to create fake purchase: ${e.message}`);
            throw e;
        }
    }
}
