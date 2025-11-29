import { Injectable } from '@nestjs/common';
import { AccountDiscountRepository } from './account-discount.repository';
import {
    AccountDiscountsToInsert,
    CreatePersonalDiscountProductsInput,
    NodeAccountDiscount,
    NodeForAccount,
    UpsertNodeDiscountInput,
} from './interfaces/account-discount.interface';

@Injectable()
export class AccountDiscountService {
    constructor(private readonly accountDiscountRepository: AccountDiscountRepository) {}

    async upsertNodeDiscount(node: UpsertNodeDiscountInput) {
        return this.accountDiscountRepository.upsertNodeDiscount(node);
    }

    async ensureNodesExist(nodes: UpsertNodeDiscountInput[]): Promise<void> {
        await this.accountDiscountRepository.ensureNodesExist(nodes);
    }

    async refreshAccountDiscountsBatch(accountIds: string[], items: AccountDiscountsToInsert[]): Promise<void> {
        await this.accountDiscountRepository.refreshAccountDiscountsBatch(accountIds, items);
    }

    async getNodesForAccounts(telegramId: string, accountIds: string[]): Promise<Map<string, NodeAccountDiscount[]>> {
        const records = await this.accountDiscountRepository.findNodesForAccounts(telegramId, accountIds);

        // Группируем результат: Map<AccountId, Node[]>
        const result = new Map<string, NodeAccountDiscount[]>();

        for (const r of records) {
            if (!result.has(r.accountId)) {
                result.set(r.accountId, []);
            }
            if (r.node) {
                result.get(r.accountId)!.push(r.node);
            }
        }
        return result;
    }

    async bulkSaveProductInfos(infos: { productId: string; article: string; sku: string | null }[]) {
        return this.accountDiscountRepository.bulkInsertProductInfos(infos);
    }

    async bulkSaveDiscountProducts(items: CreatePersonalDiscountProductsInput[]) {
        return this.accountDiscountRepository.createManyDiscountProducts(items);
    }

    /**
     * Получить список accountId, у которых есть записи в account_discount_product
     * для данного telegramId.
     */
    // async findAccountsByTelegramUser(telegramId: string): Promise<string[]> {
    //     return this.accountDiscountRepository.findAccountsByTelegramUser(telegramId);
    // }
    //
    // /**
    //  * Удалить все данные по конкретному аккаунту и telegramId
    //  * из account_discount_product. Возвращает количество удалённых строк.
    //  */
    // async deleteDataForAccount(accountId: string, telegramId: string): Promise<number> {
    //     return this.accountDiscountRepository.deleteDataForAccount(accountId, telegramId);
    // }
    //
    // /**
    //  * Найти accountId, у которых есть скидочный продукт с данным productId
    //  * для конкретного пользователя (telegramId).
    //  */
    // async findAccountsForProduct(telegramId: string, productId: string): Promise<string[]> {
    //     return this.accountDiscountRepository.findAccountsForProduct(telegramId, productId);
    // }
}
