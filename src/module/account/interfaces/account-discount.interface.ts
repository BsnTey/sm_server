export interface UpsertPersonalDiscountInput {
    accountId: string;
    telegramId: string;
    nodeId: string;
    nodeName: string;
    dateEnd: Date;
}

export interface UpsertPersonalDiscountProductsInput {
    productId: string;
    accountId: string;
    telegramId: string;
    dateEnd: Date;
}

export type NodePair = { nodeId: string; nodeName: string };
