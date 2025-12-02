export type CheckProductResultItem = {
    accountId: string;
    info?: Info;
    error?: string;
};

export type Info = {
    bonuses: number;
    ordersToday: number;
    product: Product;
};

export type Product = {
    priceOnKassa: number;
    percentMyDiscount: number;
    bonusAmount: number;
};
