export interface IReplenishmentUsersBotT {
    result: boolean;
    data: Datum[];
}

export interface Datum {
    id: number;
    bot_id: number;
    user: User;
    is_positive: boolean;
    status: number;
    item_id?: number;
    itemData: string;
    balanceType: BalanceType;
    amount: number;
    created_at: number;
    created_time: string;
    comment: string;
}

export interface BalanceType {
    id: number;
    title: string;
    image?: string;
}

export interface User {
    id: number;
    telegram_id: number;
    username: string;
    first_name: string;
    last_name: string;
    link: string;
    type: string;
}
