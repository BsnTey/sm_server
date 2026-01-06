export enum GateDecisionType {
    ALLOW_FREE = 'ALLOW_FREE', // сразу бесплатно
    ALLOW_NEED_QUOTE = 'ALLOW_NEED_QUOTE', // можно, но надо посчитать оплату (quote)
    DENY = 'DENY', // нельзя
}

export type GateDecision =
    | { type: GateDecisionType.ALLOW_FREE }
    | { type: GateDecisionType.ALLOW_NEED_QUOTE; reason: string }
    | { type: GateDecisionType.DENY; reason: string };

export enum QuoteType {
    FREE = 'FREE',
    PRICE = 'PRICE',
    ERROR = 'ERROR',
}

export type AccessQuote =
    | { type: QuoteType.FREE; reason: string }
    | { type: QuoteType.PRICE; priceRub: number; bonusBalance: number; percent: number; reason: string }
    | { type: QuoteType.ERROR; reason: string; code?: 'ACCOUNT_BLOCKED' | 'SM_UNAVAILABLE' | 'UNKNOWN' };

export type AccessPricingConfig = {
    enableBonusRule: boolean; // можно выключить потом
    freeIfBonusLessThan: number; // 500
    percent: number; // 0.03
};

export enum InviteAccessType {
    DENIED = 'DENIED',
    FREE = 'FREE',
    PAID = 'PAID',
    ERROR = 'ERROR',
}

export type InviteAccessResult =
    | { type: InviteAccessType.DENIED; reason: string }
    | { type: InviteAccessType.FREE; reason?: string }
    | { type: InviteAccessType.PAID; priceRub: number; bonusBalance: number; reason: string }
    | { type: InviteAccessType.ERROR; reason: string; code?: 'ACCOUNT_BLOCKED' | 'SM_UNAVAILABLE' | 'UNKNOWN' };
