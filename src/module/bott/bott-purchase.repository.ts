import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { CreatePurchaseAccount, PurchaseByAccountIdResult } from './interfaces/purchase-repository';

@Injectable()
export class BottPurchaseRepository {
    constructor(private prisma: PrismaService) {}

    async create(data: CreatePurchaseAccount): Promise<void> {
        await this.prisma.accountPurchase.create({ data });
    }

    async getByAccountId(accountId: string): Promise<PurchaseByAccountIdResult[]> {
        return this.prisma.accountPurchase.findMany({
            where: { accountId },
            select: {
                buyerTelegramId: true,
                purchasedAt: true,
                hasPromoCode: true,
            },
        });
    }
}
