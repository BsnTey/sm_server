import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';
import { CourseWorkService } from './courses.service';
import { UserService } from '../user/user.service';
import { UserRole } from '@prisma/client';
import { ERROR_FOUND_USER } from '../telegram/constants/error.constant';
import { BottService } from '../bott/bott.service';

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

        // 1. Рассчитываем начальную стоимость (предоплата)
        const initialPrice = this.calculatePrice(targetPoints, user.role);

        // Проверка баланса
        if (initialPrice > 0) {
            await this.bottService.getStatistics();
            const currentBalance = await this.bottService.getUserBotBalance(telegramId);
            if (currentBalance < initialPrice) {
                throw new BadRequestException(`Недостаточно средств. Нужно: ${initialPrice}₽, Баланс: ${currentBalance}₽`);
            }
        }

        // 2. Списание полной суммы (Hold)
        if (initialPrice > 0) {
            await this.paymentService.changeUserBalance(telegramId, initialPrice, false);
            this.logger.log(`Списано ${initialPrice}₽ у ${telegramId} (Предоплата за ${targetPoints} б.)`);
        }

        try {
            // 3. Выполнение работ
            const result = await this.courseWorkService.completeCoursesForAmount(accountId, targetPoints);
            const { earnedPoints, passedCount } = result;

            this.logger.log(`Результат: Пройдено ${passedCount}, Заработано ${earnedPoints} из ${targetPoints}`);

            // 4. Финальный перерасчет (Reconciliation)
            // Если роль админа (цена 0), то перерасчет не нужен
            if (initialPrice > 0) {

                // Если вообще ничего не прошли
                if (passedCount === 0 || earnedPoints === 0) {
                    this.logger.warn(`Полный отказ. Возвращаем всю сумму: ${initialPrice}₽`);
                    await this.paymentService.changeUserBalance(telegramId, initialPrice, true);
                    throw new Error('Не удалось пройти ни одного курса. Средства возвращены.');
                }

                // Считаем, сколько это стоит по факту
                const actualPrice = this.calculatePrice(earnedPoints, user.role);

                // Если фактическая стоимость меньше списанной (частичный возврат)
                if (actualPrice < initialPrice) {
                    const refundAmount = initialPrice - actualPrice;

                    this.logger.log(`Частичное выполнение. Возврат разницы: ${refundAmount}₽ (Взяли ${initialPrice}, по факту ${actualPrice})`);

                    await this.paymentService.changeUserBalance(telegramId, refundAmount, true);
                }
            }

            return { passedCount, earnedPoints };

        } catch (error: any) {
            this.logger.error(`Критическая ошибка процесса: ${error.message}`);

            if (initialPrice > 0 && !error.message.includes('Средства возвращены')) {

                await this.paymentService.changeUserBalance(telegramId, initialPrice, true);
            }

            throw new InternalServerErrorException(error.message || 'Ошибка выполнения. Средства возвращены.');
        }
    }
}