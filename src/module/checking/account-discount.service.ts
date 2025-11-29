import { Injectable } from '@nestjs/common';
import { AccountDiscountRepository } from './account-discount.repository';
import { AccountDiscountsToInsert, UpsertNodeDiscountInput } from './interfaces/account-discount.interface';

@Injectable()
export class AccountDiscountService {
    constructor(private readonly accountDiscountRepository: AccountDiscountRepository) {}

    async upsertNodeDiscount(node: UpsertNodeDiscountInput) {
        return this.accountDiscountRepository.upsertNodeDiscount(node);
    }

    /**
     * Удалить все данные по конкретному аккаунту (AccountDiscount и AccountDiscountProduct)
     */
    async clearAccountData(accountId: string): Promise<void> {
        return this.accountDiscountRepository.clearAccountData(accountId);
    }

    async ensureNodesExist(nodes: UpsertNodeDiscountInput[]): Promise<void> {
        await this.accountDiscountRepository.ensureNodesExist(nodes);
    }

    async refreshAccountDiscountsBatch(accountIds: string[], items: AccountDiscountsToInsert[]): Promise<void> {
        await this.accountDiscountRepository.refreshAccountDiscountsBatch(accountIds, items);
    }

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
}
