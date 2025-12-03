export type ResponseCheckProduct = {
    accountIds: CheckProductResultItem[];
    calcProd: CalculateProduct | null;
};

export type CheckProductResultItem = {
    accountId: string;
    info?: Info;
    error?: string;
};

export type Info = {
    bonusesOnAccount: number;
    ordersToday: number;
    product: ProductOnAccount;
};

export type ProductOnAccount = {
    avaliableBonusForProduct: number;
    avaliablePriceOnKassa: number;
};

export type CashedProduct = {
    priceCatalog: number;
    priceRetail: number;
    calc: CalculateProduct;
    percentMyDiscount: number;
};

export type CalculateProduct = {
    calcPriceForProduct: number;
    calcBonusForProduct: number;
    percentMyDiscount: number;
};
