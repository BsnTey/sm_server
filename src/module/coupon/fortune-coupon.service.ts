import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FortuneCouponRepository } from './forune-coupon.repository';
import { FortuneCoupon, FortuneSurpriseType } from '@prisma/client';
import { Prize } from './interfaces/fortune.interface';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { BottService } from '../bott/bott.service';
import { extractCsrf, extractUsersStatistics } from '../telegram/utils/payment.utils';
import { ConfigService } from '@nestjs/config';
import { SenderTelegram } from '../telegram/interfaces/telegram.context';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class FortuneCouponService {
    private readonly logger = new Logger(FortuneCouponService.name);

    private readonly prizes: Prize[] = [
        // { name: 'Купон на счет 200р. Активация в Спортивном боте', chance: 7, code: 'Replenish_200' },
        // { name: 'Купон на счет 500р. Активация в Спортивном боте', chance: 5, code: 'Replenish_500' },
        { name: 'Купон на счет 10р. Активация в Спортивном боте', chance: 30, code: 'Replenish_10' },
        // { name: 'Купон на счет 100р. Активация в Спортивном боте', chance: 23, code: 'Replenish_100' },
        { name: 'Пополнение 5%. Активация в профиле при пополнении', chance: 5, code: 'Payment_5' },
        // { name: 'Пополнение 25%. Активация в профиле при пополнении', chance: 3, code: 'Payment_25' },
        // { name: 'Пополнение 30%. Активация в профиле при пополнении', chance: 3, code: 'Payment_30' },
        { name: 'Пополнение 10%. Активация в профиле при пополнении', chance: 5, code: 'Payment_10' },
        // { name: 'Скидка 25%. Активация в Спортивном боте', chance: 13, code: 'Discount_25' },
        { name: 'Скидка 5%. Активация в Спортивном боте', chance: 60, code: 'Discount_5' },
        // { name: 'Скидка 30%. Активация в Спортивном боте', chance: 11, code: 'Discount_30' },
        // { name: 'Скидка 30%. Активация в Спортивном боте', chance: 16, code: 'Discount_30' },
        // { name: 'Скидка 50%. Активация в Спортивном боте', chance: 8, code: 'Discount_50' },
    ];

    // private readonly smallPrizes: Prize[] = [
    //     { name: 'Пополнение 25%. Активация в профиле при пополнении', chance: 8, code: 'Payment_25' },
    //     { name: 'Пополнение 30%. Активация в профиле при пополнении', chance: 5, code: 'Payment_30' },
    //     { name: 'Скидка 10%. Активация в Спортивном боте', chance: 35, code: 'Discount_10' },
    //     { name: 'Скидка 15%. Активация в Спортивном боте', chance: 26, code: 'Discount_15' },
    //     { name: 'Скидка 20%. Активация в Спортивном боте', chance: 26, code: 'Discount_20' },
    // ];

    private tgNamesExceptionStatistic = this.configService.getOrThrow<string>('TELEGRAM_NAMES_EXCEPTION_STATISTIC').split(',');

    constructor(
        private readonly couponRepository: FortuneCouponRepository,
        private readonly bottService: BottService,
        private configService: ConfigService,
    ) {}

    getRandomPrize(sender: SenderTelegram): Prize {
        return this.getRandomPrizeFromPool(this.prizes);
        // try {
        //     // const userPosition = await this.getUserPositionInStatistics(sender);
        //
        //     // if (userPosition > 15) {
        //     //     return this.getRandomPrizeFromPool(this.smallPrizes);
        //     // }
        //
        //     return this.getRandomPrizeFromPool(this.prizes);
        // } catch (error) {
        //     this.logger.error('Ошибка при получении позиции пользователя:', error);
        //     // return this.getRandomPrizeFromPool(this.smallPrizes);
        // }
    }

    private async getUserPositionInStatistics(sender: SenderTelegram): Promise<number> {
        try {
            const responseStatistics = await this.bottService.getStatistics();

            const usersStatistic = extractUsersStatistics(responseStatistics, this.tgNamesExceptionStatistic);

            const userStat = usersStatistic.find(user => user.name === sender.username || user.name === `@${sender.username}`);

            return userStat ? userStat.row : 999;
        } catch (error) {
            this.logger.error('Ошибка при получении позиции пользователя:', error);
            return 999;
        }
    }

    private getRandomPrizeFromPool(prizePool: Prize[]): Prize {
        const random = Math.random() * 100;
        let cumulative = 0;

        for (const prize of prizePool) {
            cumulative += prize.chance;
            if (random < cumulative) {
                return prize;
            }
        }

        return prizePool[prizePool.length - 1];
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
