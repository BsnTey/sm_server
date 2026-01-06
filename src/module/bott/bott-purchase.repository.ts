import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { CreatePurchaseAccount, PurchaseByAccountIdResult } from './interfaces/purchase-repository';

@Injectable()
export class BottPurchaseRepository {
    constructor(private prisma: PrismaService) {}

    async create(data: CreatePurchaseAccount){
        return this.prisma.accountPurchase.create({ data });
    }

    async getByAccountId(accountId: string): Promise<PurchaseByAccountIdResult[]> {
        return this.prisma.accountPurchase.findMany({
            where: { accountId },
            select: {
                id: true,
                buyerTelegramId: true,
                purchasedAt: true,
                hasPromoCode: true,
            },
        });
    }

    async updatePaidStatusPurchase(id: string, data: { purchasedAt?: Date; hasPromoCode?: boolean }) {
        return this.prisma.accountPurchase.update({
            where: { id },
            data: {
                purchasedAt: data.purchasedAt,
                hasPromoCode: data.hasPromoCode,
            },
        });
    }
}
