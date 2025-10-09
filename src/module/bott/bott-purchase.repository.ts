import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class BottPurchaseRepository {
    constructor(private prisma: PrismaService) {}

    async create(data: {
        id: string;
        orderNumber: string;
        lineIndex: number;
        accountId: string;
        buyerTelegramId: string;
        amount: number;
        purchasedAt?: Date;
        rawPayload: Prisma.InputJsonValue;
    }): Promise<void> {
        await this.prisma.accountPurchase.create({ data });
    }
}
