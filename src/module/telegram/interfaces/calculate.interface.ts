export interface ICalculateCash {
    outputPrices: {
        price: string;
        priceDiscount: number;
        currentBonus: number;
        currentBonusPromo: number;
        priceDiscountPromo: number;
    }[];
    totalPrice: number;
    totalDiscount: number;
    totalPriceBonus: number;
    totalDiscountPromo: number;
    totalFullDiscount: number;
    totalSumOnKassa: number;
}
