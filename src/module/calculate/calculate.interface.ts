export interface PriceAfterAllDiscounts {
    basePrice: number;
    retailPrice: number;
    discountShop: number;
    percentDiscount: number;
    limitPercent: LimitPercent;
}

export interface LimitPercent {
    isConditionsMarker: boolean;
    limitPercent: number;
    maxTotalDiscount: number;
}
