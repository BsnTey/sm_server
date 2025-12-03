import { Injectable } from '@nestjs/common';
import { ProductApiResponse } from '../account/interfaces/product.interface';
import { LimitPercent } from './calculate.interface';
import { Marker } from '../account/interfaces/search-product.interface';
import { CalculateProduct } from '../checking/interfaces/my-discount.interface';

@Injectable()
export class CalculateService {
    computeCurrentPrice(price: number, discountShop: number): number {
        if (discountShop === 0) {
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
    computeMaxBonus(basePrice: number, priceAfterPromo: number, discountShop: number, limitPercent: LimitPercent): number {
        let currentBonus = 0;

        if (0 <= discountShop && discountShop < 50) {
            const bonusPercentage = limitPercent.limitPercent / 100;
            currentBonus = priceAfterPromo * bonusPercentage;

            // Ограничение максимальной общей скидки, цена где не может быть ниже
            const maxDiscountFactor = limitPercent.maxTotalDiscount / 100;
            const limitAllDiscount = basePrice * maxDiscountFactor;

            if (basePrice - priceAfterPromo - currentBonus > limitAllDiscount) {
                currentBonus = priceAfterPromo - limitAllDiscount;
            }
        }
        return Math.floor(currentBonus);
    }

    /**
     * Цена с промокодом (без бонусов). Процент промо — аргумент (например, 10 или 15).
     */
    computePriceWithPromoWithoutBonus(
        basePrice: number,
        retailPrice: number,
        discountShop: number,
        limitPercent: LimitPercent,
        discountPercent: number,
    ): number {
        let calcPrice = retailPrice;

        if (0 <= discountShop && discountShop < 50) {
            // Ограничение максимальной общей скидки
            const maxDiscountFactor = limitPercent.maxTotalDiscount / 100;
            const maxDiscountItem = basePrice * maxDiscountFactor;

            const priceDiscountPromo = (basePrice * discountPercent) / 100;
            if (maxDiscountItem > retailPrice - priceDiscountPromo) {
                calcPrice = maxDiscountItem;
            } else {
                calcPrice = retailPrice - priceDiscountPromo;
            }
        }
        return Math.floor(calcPrice);
    }

    private getLimitBonusPercent(markers: Marker[]): LimitPercent {
        const conditionsMarkerInfo = markers.find(m => m.title === 'Условия бонусов');
        const limitBonusMarker = markers.find(m => m.title && /До\s+\d+%\s+бонусами/i.test(m.title));

        let limitPercent = 30;
        let isConditionsMarker = false;
        let maxTotalDiscount = 50;

        if (limitBonusMarker?.description) {
            const totalMatch = limitBonusMarker.description.match(/итоговая[^0-9]+не\s+более\s+(\d+)%/i);

            if (totalMatch && totalMatch[1]) {
                maxTotalDiscount = parseInt(totalMatch[1], 10);
            }
        }

        if (conditionsMarkerInfo?.description) {
            const match = conditionsMarkerInfo.description.match(/списать бонусы до\s+(\d+)%/i);
            if (match && match[1]) {
                limitPercent = parseInt(match[1], 10);
                isConditionsMarker = true;
            }
        } else if (limitBonusMarker) {
            const match = limitBonusMarker.title.match(/(\d+)/);
            if (match && match[1]) {
                limitPercent = parseInt(match[1], 10);
            }
        }

        return {
            isConditionsMarker,
            limitPercent,
            maxTotalDiscount,
        };
    }

    computeCalculateFromProduct(p: ProductApiResponse['product'], promoPercent: number): CalculateProduct {
        const catalog = Number(p.price.catalog.value);
        const retail = Number(p.price.retail.value);

        const basePrice = catalog / 100; //базовая цена
        const retailPrice = retail / 100; //цена со скидкой от магазина (если есть)

        const discountShop = Math.floor((1 - retailPrice / basePrice) * 100);

        const limitPercent = this.getLimitBonusPercent(p.markers || []);

        const priceAfterPromo = this.computePriceWithPromoWithoutBonus(basePrice, retailPrice, discountShop, limitPercent, promoPercent);
        const bonus = this.computeMaxBonus(basePrice, priceAfterPromo, discountShop, limitPercent);

        const priceOnKassa = priceAfterPromo - bonus;

        return {
            calcPriceForProduct: priceOnKassa,
            calcBonusForProduct: bonus,
            percentMyDiscount: promoPercent,
        };
    }

    calcPercentMyDiscount(p: ProductApiResponse['product']): number {
        const list = p?.personalPrice?.discountList ?? [];
        const value = list.find(x => x?.actionName?.toLowerCase() === 'моя скидка');

        const catalogVal = Number(p.price.catalog.value);
        if (!value || !catalogVal) return 0;

        const summaDiscount = Number(value.summa.value) / 100;
        const priceCatalog = catalogVal / 100;

        return Number(((summaDiscount / priceCatalog) * 100).toFixed(1));
    }
}
