import { Injectable } from '@nestjs/common';
import { ProductApiResponse } from '../account/interfaces/product.interface';

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

    computeCalculateProductFromProduct(
        p: ProductApiResponse['product'],
        isInventory: boolean,
        promoPercent: number = 15,
    ): { price: number; bonus: number } | null {
        const catalog = Number(p?.price?.catalog?.value);
        const retail = Number(p?.price?.retail?.value);
        if (!isFinite(catalog) || !isFinite(retail) || catalog <= 0 || retail <= 0) {
            return null;
        }

        const basePrice = catalog / 100;
        const retailPrice = retail / 100;

        let discountShop = Math.floor((1 - retailPrice / basePrice) * 100);
        if (!isFinite(discountShop) || discountShop < 0) discountShop = 0;
        if (discountShop > 100) discountShop = 100;

        const priceAfterPromo =
            discountShop < 50
                ? this.computePriceWithPromoWithoutBonus(basePrice, retailPrice, discountShop, isInventory, promoPercent)
                : retailPrice;

        const bonus = this.computeBonus(basePrice, priceAfterPromo, discountShop, isInventory);

        const priceOnKassa = priceAfterPromo - bonus;

        return {
            price: Math.floor(priceOnKassa),
            bonus: Math.floor(bonus),
        };
    }
}
