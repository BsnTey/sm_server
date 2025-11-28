export type CheckProductResultItem = {
    accountId: string;
    bonuses: number;
    ordersToday: number;
    product: Product;
    error?: string;
};

export type Product = {
    priceOnKassa: number;
    percentMyDiscount: number;
    priceCatalog: number;
    priceRetail: number;
    potentialBonus: number;
    calculate: {
        price: number;
        bonus: number;
    };
};
