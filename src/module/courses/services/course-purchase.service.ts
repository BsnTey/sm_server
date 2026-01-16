import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { PaymentService } from '../../payment/payment.service';
import { CourseWorkService } from './courses.service';
import { UserService } from '../../user/user.service';
import { UserRole } from '@prisma/client';
import { ERROR_FOUND_USER } from '../../telegram/constants/error.constant';
import { BottService } from '../../bott/bott.service';

const PRICE_PERCENT = 0.05; // 5% от суммы баллов

@Injectable()
export class CoursePurchaseService {
    private readonly logger = new Logger(CoursePurchaseService.name);

    constructor(
        private readonly bottService: BottService,
        private readonly paymentService: PaymentService,
        private readonly courseWorkService: CourseWorkService,
        private readonly userService: UserService,
    ) {}

    /**
     * Расчет стоимости
     */
    calculatePrice(pointsAmount: number, role: UserRole): number {
        if (role === UserRole.Admin) return 0;
        return Math.ceil(pointsAmount * PRICE_PERCENT);
    }

    /**
     * Процесс покупки и выполнения курсов
     */
    async processCoursePurchase(telegramId: string, accountId: string, targetPoints: number) {
        const user = await this.userService.getUserByTelegramId(telegramId);
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        const initialPrice = this.calculatePrice(targetPoints, user.role);

        if (initialPrice > 0) {
            await this.bottService.getStatistics();
            const currentBalance = await this.bottService.getUserBotBalance(telegramId);
            if (currentBalance < initialPrice) {
                throw new BadRequestException(`Недостаточно средств. Нужно: ${initialPrice}₽, Баланс: ${currentBalance}₽`);
            }
        }

        if (initialPrice > 0) {
            await this.paymentService.changeUserBalance(telegramId, initialPrice, false);
            this.logger.log(`Списано ${initialPrice}₽ у ${telegramId} (Предоплата за ${targetPoints} б.) для ${accountId}`);
        }

        try {
            const result = await this.courseWorkService.completeCoursesForAmount(accountId, targetPoints);
            const { earnedPoints, passedCount } = result;

            this.logger.log(`Результат: Пройдено ${passedCount}, Заработано ${earnedPoints} из ${targetPoints} для ${accountId}`);

            if (initialPrice > 0) {
                if (passedCount === 0 || earnedPoints === 0) {
                    this.logger.warn(`Полный отказ. Возвращаем всю сумму: ${initialPrice}₽ для ${accountId}`);
                    await this.paymentService.changeUserBalance(telegramId, initialPrice, true);
                    throw new Error('Не удалось пройти ни одного курса. Средства возвращены.');
                }

                const actualPrice = this.calculatePrice(earnedPoints, user.role);

                if (actualPrice < initialPrice) {
                    const refundAmount = initialPrice - actualPrice;
                    this.logger.log(`Частичный возврат: ${refundAmount}₽ для ${accountId}`);
                    await this.paymentService.changeUserBalance(telegramId, refundAmount, true);
                }
            }
            return { passedCount, earnedPoints };
        } catch (error: any) {
            this.logger.error(`Критическая ошибка: ${error.message} для ${accountId}`);
            if (initialPrice > 0 && !error.message.includes('Средства возвращены')) {
                await this.paymentService.changeUserBalance(telegramId, initialPrice, true);
            }
            throw new InternalServerErrorException(error.message || 'Ошибка выполнения. Средства возвращены.');
        }
    }

    /**
     * Логика оплаты и постановки в очередь (Start Work)
     */
    async processWorkQueuePurchase(telegramId: string, accountId: string, targetPoints: number) {
        const user = await this.userService.getUserByTelegramId(telegramId);
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        // 1. Расчет стоимости
        const price = this.calculatePrice(targetPoints, user.role);

        // 2. Проверка баланса
        if (price > 0) {
            await this.bottService.getStatistics();
            const balance = await this.bottService.getUserBotBalance(telegramId);
            if (balance < price) {
                throw new BadRequestException(`Недостаточно средств. Нужно ${price}₽, Баланс: ${balance}₽`);
            }
        }

        // 3. Списание средств
        if (price > 0) {
            await this.paymentService.changeUserBalance(telegramId, price, false);
            this.logger.log(`Списано ${price}₽ у ${telegramId} за постановку в очередь (${targetPoints} б.) для ${accountId}`);
        }

        try {
            // 4. Постановка в очередь
            // queueCoursesForAmount должен возвращать количество курсов
            const count = await this.courseWorkService.queueCoursesForAmount(accountId, targetPoints, telegramId);

            this.logger.log(`Успешно поставлено в очередь ${count} курсов для ${accountId}`);

            return { count, price };

        } catch (error: any) {
            this.logger.error(`Ошибка постановки в очередь: ${error.message} для ${accountId}`);

            // 5. ROLLBACK: Если не удалось поставить в очередь — возвращаем деньги
            if (price > 0) {
                this.logger.warn(`Возврат средств ${price}₽ для ${telegramId} для ${accountId}`);
                await this.paymentService.changeUserBalance(telegramId, price, true);
            }

            throw new InternalServerErrorException(error.message || 'Ошибка постановки в очередь. Средства возвращены.');
        }
    }
}
