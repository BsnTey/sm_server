import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { FortuneCoupon, FortuneSurpriseType } from '@prisma/client';

@Injectable()
export class FortuneCouponRepository {
    constructor(private readonly prisma: PrismaService) {}

    async getCouponByCode(coupon: string): Promise<FortuneCoupon | null> {
        return this.prisma.fortuneCoupon.findUnique({
            where: { coupon },
        });
    }

    async redeemCoupon(couponId: string): Promise<FortuneCoupon> {
        const coupon = await this.getCouponByCode(couponId);
        if (!coupon) {
            throw new NotFoundException('Купон не найден');
        }
        const newUsageCount = coupon.usageCount + 1;
        const updateData: any = { usageCount: newUsageCount };
        if (newUsageCount >= coupon.maxUsage) {
            updateData.isActive = false;
            updateData.redeemedAt = new Date();
        }
        return this.prisma.fortuneCoupon.update({
            where: { id: coupon.id },
            data: updateData,
        });
    }

    async restoreCoupon(couponId: string): Promise<FortuneCoupon> {
        return this.prisma.fortuneCoupon.update({
            where: { id: couponId },
            data: {
                isActive: true,
                usageCount: { decrement: 1 },
                updatedAt: new Date(),
            },
        });
    }

    async getPrizeForToday(telegramId: string): Promise<FortuneCoupon | null> {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        return this.prisma.fortuneCoupon.findFirst({
            where: {
                owner: telegramId,
                createdAt: { gte: startOfToday },
            },
        });
    }

    async createCoupon(data: {
        coupon: string;
        type: FortuneSurpriseType;
        value: number;
        isActive: boolean;
        expiresAt: Date;
        usageCount?: number;
        maxUsage?: number;
        description?: string;
        owner: string;
    }): Promise<FortuneCoupon> {
        return this.prisma.fortuneCoupon.create({
            data: {
                coupon: data.coupon,
                type: data.type,
                value: data.value,
                isActive: data.isActive,
                expiresAt: data.expiresAt,
                usageCount: data.usageCount ?? 0,
                maxUsage: data.maxUsage ?? 1,
                description: data.description,
                owner: data.owner,
            },
        });
    }
}
