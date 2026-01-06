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
        //здесь идет платный процесс обьединения. валидность аккаунта уже была проверена и пользователь согласился на цену.

        // 1. Проверить баланс (Payment Service)
        const currentBalance = await this.bottService.getUserBotBalance(telegramId);

        if (currentBalance < amount) {
            throw new BadRequestException(`На балансе не хватает ${amount - currentBalance}р`);
        }

        // --- НАЧАЛО ТРАНЗАКЦИОННОЙ ЛОГИКИ ---
        // Сначала списываем, потом делаем
        // Если инвайт упадет — вернем деньги.

        const isPositive = false;
        await this.paymentService.changeUserBalance(telegramId, amount, isPositive);

        let inviteSent = false;
        try {
            let lastPurchase = await this.bottPurchaseService.getLastPurchaseByAccountId(invitedAccountId);

            if (!lastPurchase) {
                this.logger.log(`Purchase not found for ${invitedAccountId}, trying to import...`);

                // Пытаемся импортировать
                try {
                    const responseHTML = await this.bottService.searchOrderFromApi(invitedAccountId);
                    await this.bottWebhookService.importOrdersFromHtml(responseHTML);
                } catch (e: any) {
                    this.logger.warn(`Failed to import orders: ${e.message}`);
                }

                // Проверяем снова
                lastPurchase = await this.bottPurchaseService.getLastPurchaseByAccountId(invitedAccountId);

                // Если все еще нет — создаем ФЕЙК
                if (!lastPurchase) {
                    this.logger.warn(`Creating fake purchase fallback for ${invitedAccountId}`);
                    await this.bottPurchaseService.createFakePurchase(invitedAccountId, telegramId);

                    lastPurchase = await this.bottPurchaseService.getLastPurchaseByAccountId(invitedAccountId);
                }
            }

            if (!lastPurchase) {
                throw new Error('Не удалось создать или найти запись о покупке. Операция отменена.');
            }

            await this.familyService.doInvite(ownerAccountId, invitedAccountId);
            inviteSent = true; // Инвайт ушел успешно

            // 5. ОБНОВЛЕНИЕ ДАТЫ ПОКУПКИ
            const now = new Date();
            const removePromo = false;
            await this.bottPurchaseService.updatePurchase(lastPurchase.id, now, removePromo);
        } catch (error: any) {
            this.logger.error(`Ошибка в processFamilyInvitePurchase: ${error.message}`, error.stack);

            // 6. ROLLBACK (Возврат средств)
            // Возвращаем деньги ТОЛЬКО если инвайт НЕ был отправлен.
            if (!inviteSent) {
                await this.paymentService.changeUserBalance(telegramId, amount, !isPositive); // !isPositive = true (возврат)
                throw new InternalServerErrorException(error.message || 'Ошибка при создании приглашения. Средства возвращены.');
            } else {
                // Если инвайт ушел, но упало обновление БД (updatePurchase)
                // ДЕНЬГИ НЕ ВОЗВРАЩАЕМ, иначе будет халява.
                // Просто логируем для админа, что данные в БД устарели.
                this.logger.error(`CRITICAL: Invite sent for account ${invitedAccountId}, but DB update failed. User was charged.`);
            }
        }
    }
}
