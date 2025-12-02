import { Injectable } from '@nestjs/common';
import { AccountDiscountRepository } from './account-discount.repository';
import {
    AccountDiscountsToInsert,
    CreatePersonalDiscountProductsInput,
    NodeAccountDiscount,
    NodePair,
    UpsertNodeDiscountInput,
} from './interfaces/account-discount.interface';
import { keyDiscountNodes } from './cache-key/key';
import { RedisCacheService } from '../cache/cache.service';

@Injectable()
export class AccountDiscountService {
    private TTL_CASH_DISCOUNT = 3_600;

    constructor(
        private readonly accountDiscountRepository: AccountDiscountRepository,
        private readonly cacheService: RedisCacheService,
    ) { }

    async upsertNodeDiscount(node: UpsertNodeDiscountInput) {
        return this.accountDiscountRepository.upsertNodeDiscount(node);
    }

    async ensureNodesExist(nodes: UpsertNodeDiscountInput[]): Promise<void> {
        await this.accountDiscountRepository.ensureNodesExist(nodes);
    }

    async deleteAccountDiscountsBatch(accountIds: string[], telegramId: string): Promise<void> {
        await this.accountDiscountRepository.deleteAccountDiscountsBatch(accountIds, telegramId);
    }

    async deleteAllByTelegramId(telegramId: string): Promise<number> {
        const key = keyDiscountNodes(telegramId);
        await this.cacheService.del(key);
        return this.accountDiscountRepository.deleteAllByTelegramId(telegramId);
    }

    async createAccountDiscountsBatch(items: AccountDiscountsToInsert[]): Promise<void> {
        await this.accountDiscountRepository.createAccountDiscountsBatch(items);
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

    async findDistinctAccountIdsByTelegram(telegramId: string): Promise<string[]> {
        return this.accountDiscountRepository.findDistinctAccountIdsByTelegram(telegramId);
    }

    async getDistinctNodePairsByTelegram(telegramId: string): Promise<{ nodes: NodePair[] }> {
        const key = keyDiscountNodes(telegramId);

        const nodesCache = await this.cacheService.get<NodePair[]>(key);

        if (nodesCache) return { nodes: nodesCache };

        const nodes = await this.accountDiscountRepository.findDistinctNodePairsByTelegram(telegramId);

        await this.cacheService.set(key, nodes, this.TTL_CASH_DISCOUNT);

        return { nodes };
    }

    async findAccountIdsByTelegramAndNodes(telegramId: string, nodeIds: string[]): Promise<string[]> {
        return this.accountDiscountRepository.findAccountIdsByTelegramAndNodes(telegramId, nodeIds);
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

    //
    // /**
    //  * Найти accountId, у которых есть скидочный продукт с данным productId
    //  * для конкретного пользователя (telegramId).
    //  */
    // async findAccountsForProduct(telegramId: string, productId: string): Promise<string[]> {
    //     return this.accountDiscountRepository.findAccountsForProduct(telegramId, productId);
    // }
}
