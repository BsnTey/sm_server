import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PaymentService } from '../../../payment/payment.service';
import { FamilyService } from './family.service';
import { BottService } from '../../../bott/bott.service';
import { BottPurchaseService } from '../../../bott/bott-purchase.service';
import { BottWebhookService } from '../../../bott/bott-webhook.service';

@Injectable()
export class FamilyPurchaseService {
    private readonly logger = new Logger(FamilyPurchaseService.name);

    constructor(
        private readonly bottService: BottService,
        private readonly paymentService: PaymentService,
        private readonly familyService: FamilyService,
        private readonly bottPurchaseService: BottPurchaseService,
        private readonly bottWebhookService: BottWebhookService,
    ) {}

    /**
     * Основной метод, который выполняет всю процедуру
     */
    async processFamilyInvitePurchase(telegramId: string, ownerAccountId: string, invitedAccountId: string, amount: number): Promise<void> {
        // 1. ВАЖНО: Лучше, чтобы проверка и списание были в changeUserBalance.
        await this.bottService.getStatistics();
        const currentBalance = await this.bottService.getUserBotBalance(telegramId);
        if (currentBalance < amount) {
            throw new BadRequestException(`На балансе не хватает ${amount - currentBalance}р`);
        }

        // 2. Списание средств
        const isPositive = false; // false = списание
        await this.paymentService.changeUserBalance(telegramId, amount, isPositive);

        let inviteSent = false;
        let lastPurchase;

        try {
            // 3. ПОИСК ИЛИ СОЗДАНИЕ ПОКУПКИ (Resilient Logic)
            lastPurchase = await this.bottPurchaseService.getLastPurchaseByAccountId(invitedAccountId);

            if (!lastPurchase) {
                this.logger.log(`Purchase not found locally for ${invitedAccountId}. Attempting remote search...`);

                try {
                    // Пробуем найти и импортировать
                    const responseHTML = await this.bottService.searchOrderFromApi(invitedAccountId);
                    const importedCount = await this.bottWebhookService.importOrdersFromHtml(responseHTML);

                    this.logger.log(`Import result for ${invitedAccountId}: ${importedCount} orders.`);

                    // Если ничего не нашли - нужен фейк
                    if (importedCount === 0) {
                        this.logger.warn(`Search returned 0 results. Creating FAKE for ${invitedAccountId}`);
                        await this.bottPurchaseService.createFakePurchase(invitedAccountId, telegramId);
                    }
                } catch (importError: any) {
                    // Если API поиска упало или парсинг сломался - не страшно, создаем фейк
                    this.logger.error(`Import failed for ${invitedAccountId}: ${importError.message}. Fallback to FAKE.`);
                    await this.bottPurchaseService.createFakePurchase(invitedAccountId, telegramId);
                }

                // Финальная попытка получить запись (реальную импортированную или фейковую)
                lastPurchase = await this.bottPurchaseService.getLastPurchaseByAccountId(invitedAccountId);
            }

            // Если даже после всех попыток записи нет — это Dead End.
            if (!lastPurchase) {
                throw new Error(`Критическая ошибка получения записи покупки для: ${invitedAccountId}`);
            }

            // 4. ГЛАВНОЕ ДЕЙСТВИЕ (Инвайт)
            await this.familyService.doInvite(ownerAccountId, invitedAccountId);

            // --- ТОЧКА НЕВОЗВРАТА ПРОЙДЕНА ---
            inviteSent = true;

            // 5. ОБНОВЛЕНИЕ ДАННЫХ (Post-action)
            const now = new Date();
            const removePromo = false;
            await this.bottPurchaseService.updatePurchase(lastPurchase.id, now, removePromo);

        } catch (error: any) {
            this.logger.error(`Transaction failed: ${error.message}`, error.stack);

            if (!inviteSent) {
                // 6. ROLLBACK (Возврат средств)
                this.logger.warn(`Initiating refund of ${amount} to ${telegramId}...`);
                try {
                    const negativeBalance = true;
                    await this.paymentService.changeUserBalance(telegramId, amount, negativeBalance);
                } catch (refundError: any) {
                    this.logger.error(`CRITICAL: Refund failed for ${telegramId}! Amount: ${amount}. Reason: ${refundError.message}`);
                }

                // Пробрасываем ошибку пользователю
                throw new InternalServerErrorException(error.message || 'Ошибка выполнения. Средства возвращены.');
            } else {
                // 7. ИНВАЙТ ПРОШЕЛ, НО УПАЛО ОБНОВЛЕНИЕ БД
                // Деньги не возвращаем. Логируем инцидент.
                this.logger.error(
                    `DATA INCONSISTENCY: Invite sent for ${invitedAccountId}, but DB update failed. ` +
                    `User ${telegramId} was charged. Purchase ID: ${lastPurchase?.id}`
                );
            }
        }
    }
}
