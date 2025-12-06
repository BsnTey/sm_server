import { Injectable } from '@nestjs/common';
import { ProductApiResponse } from '../account/interfaces/product.interface';
import { CalculateProduct } from '../checking/interfaces/my-discount.interface';
import { ApiAdapter } from './api.adapter';
import { SportmasterCalculator } from './sportmaster-calculator';
import { CalculationMode, CalculationResult, CalculatorInput } from './calculator.types';

/**
 * Сервис-обёртка для использования калькулятора в NestJS.
 * Предоставляет удобные методы для работы с API-данными.
 */
@Injectable()
export class CalculateService {
    /**
     * Получить расчёт для всех режимов (BONUS_ONLY, PROMO_CODE, MY_DISCOUNT)
     */
    getCalculationAll(product: ProductApiResponse['product']): Record<CalculationMode, CalculationResult> {
        const input = ApiAdapter.parseCalculatorInput(product);
        return SportmasterCalculator.calculateAll(input);
    }

    /**
     * Получить расчёт для конкретного режима
     */
    getCalculation(product: ProductApiResponse['product'], mode: CalculationMode): CalculationResult {
        const input = ApiAdapter.parseCalculatorInput(product);
        return SportmasterCalculator.calculate(input, mode);
    }

    /**
     * Расчёт с "Моей скидкой" — основной метод для checking.service
     */
    computeCalculateFromProduct(product: ProductApiResponse['product']): CalculateProduct {
        const input = ApiAdapter.parseCalculatorInput(product);
        const percentMyDiscount = ApiAdapter.calcMyDiscountPercent(product);

        // Если есть "Моя скидка", используем режим MY_DISCOUNT, иначе BONUS_ONLY
        const mode = input.prices.myDiscountValue > 0 ? CalculationMode.MY_DISCOUNT : CalculationMode.BONUS_ONLY;
        const result = SportmasterCalculator.calculate(input, mode);

        return {
            calcPriceForProduct: result.finalPrice,
            calcBonusForProduct: result.usedBonusesRub,
            usedMyDiscountRub: result.usedMyDiscountRub,
            percentMyDiscount,
        };
    }

    /**
     * Расчёт для Telegram-бота с ручным вводом (без API данных)
     */
    calculateFromManualInput(
        catalogPrice: number,
        discountShopPercent: number,
        options: {
            isInventory?: boolean;
            promoCodePercent?: number;
        } = {},
    ): { bonusOnly: CalculationResult; withPromo: CalculationResult } {
        const { isInventory = false, promoCodePercent = 10 } = options;

        // Вычисляем retail цену
        let retail = catalogPrice;
        if (discountShopPercent > 0) {
            retail = catalogPrice * (1 - discountShopPercent / 100);
            // Округление как в старом коде
            if (discountShopPercent % 5 !== 0) {
                const lastNumberPrice = retail % 100;
                const roundPrice = Math.floor(retail / 100) * 100;
                retail = lastNumberPrice < 50 ? roundPrice - 1 : roundPrice + 99;
            }
            retail = Math.floor(retail);
        }

        const input: CalculatorInput = {
            prices: {
                catalog: catalogPrice,
                retail,
                myDiscountValue: 0,
            },
            flags: {
                isBestPrice: false,
                isFinalPrice: false,
                isOfferOfWeek: false,
                isPriceReduced: false,
                isSpecialCondition: false,
                isBonusCondition: false,
                isBonus20: isInventory,
            },
            constraints: {
                explicitBonusLimitPercent: isInventory ? 20 : null,
                explicitTotalLimitPercent: isInventory ? 30 : null,
            },
            promoCodePercent,
        };

        return {
            bonusOnly: SportmasterCalculator.calculate(input, CalculationMode.BONUS_ONLY),
            withPromo: SportmasterCalculator.calculate(input, CalculationMode.PROMO_CODE),
        };
    }
}
