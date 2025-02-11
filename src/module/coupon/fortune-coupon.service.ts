import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FortuneCouponRepository } from './forune-coupon.repository';
import { FortuneCoupon, FortuneSurpriseType } from '@prisma/client';
import { Prize } from './interfaces/fortune.interface';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { BottService } from '../bott/bott.service';
import { extractCsrf } from '../telegram/utils/payment.utils';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class FortuneCouponService {
    private readonly prizes: Prize[] = [
        { name: 'Купон на счет 200р. Активация в Спортивном боте', chance: 7, code: 'Replenish_200' },
        { name: 'Купон на счет 500р. Активация в Спортивном боте', chance: 5, code: 'Replenish_500' },
        { name: 'Купон на счет 50р. Активация в Спортивном боте', chance: 25, code: 'Replenish_50' },
        { name: 'Купон на счет 100р. Активация в Спортивном боте', chance: 21, code: 'Replenish_100' },
        { name: 'Пополнение 25%. Активация в профиле при пополнении', chance: 3, code: 'Payment_25' },
        { name: 'Пополнение 30%. Активация в профиле при пополнении', chance: 3, code: 'Payment_30' },
        { name: 'Скидка 25%. Активация в Спортивном боте', chance: 13, code: 'Discount_25' },
        { name: 'Скидка 30%. Активация в Спортивном боте', chance: 13, code: 'Discount_30' },
        { name: 'Скидка 50%. Активация в Спортивном боте', chance: 10, code: 'Discount_50' },
    ];

    constructor(
        private readonly couponRepository: FortuneCouponRepository,
        private readonly bottService: BottService,
    ) {}

    getRandomPrize(): Prize {
        const random = Math.random() * 100;
        let cumulative = 0;
        for (const prize of this.prizes) {
            cumulative += prize.chance;
            if (random < cumulative) {
                return prize;
            }
        }
        return this.prizes[this.prizes.length - 1];
    }

    async getPrizeForToday(telegramId: string): Promise<FortuneCoupon | null> {
        return this.couponRepository.getPrizeForToday(telegramId);
    }

    private generateCouponCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async awardPrizeToUser(prize: Prize, telegramId: string): Promise<FortuneCoupon> {
        const generatedCode = this.generateCouponCode();
        const expiresAt = dayjs().tz('Europe/Moscow').set('hour', 23).set('minute', 59).set('second', 59).set('millisecond', 999).toDate();

        let type: FortuneSurpriseType;
        let value: number;
        if (prize.code.startsWith('Replenish')) {
            type = FortuneSurpriseType.Replenish;
            value = parseInt(prize.code.split('_')[1], 10);
        } else if (prize.code.startsWith('Payment')) {
            type = FortuneSurpriseType.Payment;
            value = parseInt(prize.code.split('_')[1], 10);
        } else if (prize.code.startsWith('Discount')) {
            type = FortuneSurpriseType.Discount;
            value = parseInt(prize.code.split('_')[1], 10);
        } else {
            throw new NotFoundException('Неизвестный тип приза');
        }

        if (type === FortuneSurpriseType.Replenish) {
            const responseStatistics = await this.bottService.getStatistics();
            const csrfToken = extractCsrf(responseStatistics);
            const activateAt = dayjs(expiresAt).format('YYYY-MM-DDTHH:mm');
            const promoStatus = await this.bottService.createReplenishPromocode(csrfToken, generatedCode, value, 1, activateAt);
            if (promoStatus !== 302 && promoStatus !== 200) {
                throw new BadRequestException('Не удалось создать промокод для начисления');
            }
            return this.couponRepository.createCoupon({
                coupon: generatedCode,
                type: type,
                value: value,
                isActive: true,
                expiresAt: expiresAt,
                usageCount: 0,
                maxUsage: 1,
                description: prize.name,
                owner: telegramId,
            });
        } else if (type === FortuneSurpriseType.Discount) {
            const responseStatistics = await this.bottService.getStatistics();
            const csrfToken = extractCsrf(responseStatistics);
            const activateAt = dayjs(expiresAt).format('YYYY-MM-DDTHH:mm');
            const promoStatus = await this.bottService.createPromocode(csrfToken, generatedCode, value, 1, activateAt);
            if (promoStatus !== 200) {
                throw new BadRequestException('Не удалось создать промокод для скидки');
            }
            return this.couponRepository.createCoupon({
                coupon: generatedCode,
                type: type,
                value: value,
                isActive: true,
                expiresAt: expiresAt,
                usageCount: 0,
                maxUsage: 1,
                description: prize.name,
                owner: telegramId,
            });
        } else {
            return this.couponRepository.createCoupon({
                coupon: generatedCode,
                type: type,
                value: value,
                isActive: true,
                expiresAt: expiresAt,
                usageCount: 0,
                maxUsage: 1,
                description: prize.name,
                owner: telegramId,
            });
        }
    }

    async validateAndRedeemCoupon(couponCode: string, telegramId: string) {
        const coupon = await this.couponRepository.getCouponByCode(couponCode);
        if (!coupon) {
            throw new NotFoundException('Купон не найден');
        }
        if (coupon.type !== FortuneSurpriseType.Payment) {
            throw new BadRequestException('Купон не для пополнения');
        }
        if (!coupon.isActive) {
            throw new BadRequestException('Купон уже использован или не активен');
        }
        if (coupon.expiresAt < new Date()) {
            throw new BadRequestException('Купон просрочен');
        }
        if (coupon.owner && coupon.owner !== telegramId) {
            throw new BadRequestException('Купон не принадлежит этому пользователю');
        }
        return await this.couponRepository.redeemCoupon(couponCode);
    }

    async restoreCoupon(couponId: string): Promise<FortuneCoupon> {
        return this.couponRepository.restoreCoupon(couponId);
    }
}
