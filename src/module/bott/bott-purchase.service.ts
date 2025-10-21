import { Injectable } from '@nestjs/common';
import { BottPurchaseRepository } from './bott-purchase.repository';
import { CreatePurchaseAccount } from './interfaces/purchase-repository';

@Injectable()
export class BottPurchaseService {
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
}
