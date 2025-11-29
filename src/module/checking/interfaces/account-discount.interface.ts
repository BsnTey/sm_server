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

export interface CreatePersonalDiscountProductsInput {
    productId: string;
    accountId: string;
    telegramId: string;
    nodeId: string;
}

export type NodePair = { nodeId: string; nodeName: string };

export interface NodeForAccount {
    accountId: string;
    node: NodeAccountDiscount;
}

export interface NodeAccountDiscount {
    url: string;
    nodeId: string;
}
