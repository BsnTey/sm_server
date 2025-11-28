import { Injectable } from '@nestjs/common';
import { AccountDiscountRepository } from './account-discount.repository';
import { UpsertPersonalDiscountProductsInput } from '../checking/interfaces/account-discount.interface';

@Injectable()
export class AccountDiscountService {
    constructor(private readonly accountDiscountRepository: AccountDiscountRepository) {}

    /**
     * Получить список accountId, у которых есть записи в account_discount_product
     * для данного telegramId.
     */
    async findAccountsByTelegramUser(telegramId: string): Promise<string[]> {
        return this.accountDiscountRepository.findAccountsByTelegramUser(telegramId);
    }

    /**
     * Удалить все данные по конкретному аккаунту и telegramId
     * из account_discount_product. Возвращает количество удалённых строк.
     */
    async deleteDataForAccount(accountId: string, telegramId: string): Promise<number> {
        return this.accountDiscountRepository.deleteDataForAccount(accountId, telegramId);
    }

    /**
     * Найти accountId, у которых есть скидочный продукт с данным productId
     * для конкретного пользователя (telegramId).
     */
    async findAccountsForProduct(telegramId: string, productId: string): Promise<string[]> {
        return this.accountDiscountRepository.findAccountsForProduct(telegramId, productId);
    }

    /**
     * Массовый upsert записей в account_discount_product.
     */
    async upsertManyDiscountProducts(items: UpsertPersonalDiscountProductsInput[]): Promise<void> {
        return this.accountDiscountRepository.upsertManyDiscountProducts(items);
    }
}
