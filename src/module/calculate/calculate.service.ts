import { Injectable } from '@nestjs/common';

@Injectable()
export class CalculateService {
    computeCurrentPrice(price: number, discountShop: number): number {
        if (discountShop === 228) {
            return price;
        }
        let currentPriceItem = (1 - discountShop / 100) * price;

        if (discountShop % 5 !== 0) {
            const lastNumberPrice = currentPriceItem % 100;
            const roundPrice = Math.floor(currentPriceItem / 100) * 100;
            currentPriceItem = lastNumberPrice < 50 ? roundPrice - 1 : roundPrice + 99;
        }

        return Math.floor(currentPriceItem);
    }

    /**
     * Расчёт применимых бонусов (без промокода), с учётом ограничений для инвентаря.
     */
    computeBonus(price: number, currentPriceItem: number, discountShop: number, isInventory = false): number {
        let currentBonus = 0;

        if (0 <= discountShop && discountShop < 50) {
            // 20% для инвентаря, 30% — для обычных товаров
            const bonusPercentage = isInventory ? 0.2 : 0.3;
            currentBonus = currentPriceItem * bonusPercentage;

            // Ограничение максимальной общей скидки: 30% инвентарь / 50% обычные
            const maxDiscountFactor = isInventory ? 0.3 : 0.5;
            const maxDiscountItem = price * maxDiscountFactor;

            if (currentPriceItem - currentBonus < price - maxDiscountItem) {
                currentBonus = currentPriceItem - (price - maxDiscountItem);
            }
        }
        return Math.floor(currentBonus);
    }

    /**
     * Цена с промокодом (без бонусов). Процент промо — аргумент (например, 10 или 15).
     */
    computePriceWithPromoWithoutBonus(
        price: number,
        currentPriceItem: number,
        discountShop: number,
        isInventory = false,
        promoPercent = 10,
    ): number {
        let calcPrice = currentPriceItem;

        if (0 <= discountShop && discountShop < 50) {
            const factor = 1 - promoPercent / 100;
            const priceWithPromo = currentPriceItem * factor;

            // Ограничение максимальной общей скидки: 30% инвентарь / 50% обычные
            const maxDiscountFactor = isInventory ? 0.3 : 0.5;
            const maxDiscountItem = price * maxDiscountFactor;

            if (price - priceWithPromo > maxDiscountItem) {
                calcPrice = price - maxDiscountItem;
            } else {
                calcPrice = priceWithPromo;
            }
        }
        return Math.floor(calcPrice);
    }
}
