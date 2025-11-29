export interface UpsertNodeDiscountInput {
    nodeId: string;
    nodeName: string;
    url: string;
    dateEnd: Date;
}

export interface AccountDiscountsToInsert {
    accountId: string;
    telegramId: string;
    nodeId: string;
}

export interface UpsertPersonalDiscountProductsInput {
    productId: string;
    accountId: string;
    telegramId: string;
    dateEnd: Date;
}

export type NodePair = { nodeId: string; nodeName: string };
