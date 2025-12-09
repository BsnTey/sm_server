import { CalculationResult, CalculationMode, CalculatorInput } from './calculator.types';

/**
 * Единый калькулятор Sportmaster.
 *
 * @shared - Этот файл идентичен на клиенте и бэкенде.
 * При изменениях логики — копируем файл целиком.
 */
export class SportmasterCalculator {
    private static readonly BASE_MAX_TOTAL_DISCOUNT = 50;
    private static readonly BASE_BONUS_PERCENT = 30;

    static calculateAll(input: CalculatorInput): Record<CalculationMode, CalculationResult> {
        return {
            [CalculationMode.BONUS_ONLY]: this.calculate(input, CalculationMode.BONUS_ONLY),
            [CalculationMode.PROMO_CODE]: this.calculate(input, CalculationMode.PROMO_CODE),
            [CalculationMode.MY_DISCOUNT]: this.calculate(input, CalculationMode.MY_DISCOUNT),
        };
    }

    static calculate(input: CalculatorInput, mode: CalculationMode = CalculationMode.BONUS_ONLY): CalculationResult {
        const { catalog, retail } = input.prices;
        const limits = this.determineLimits(input, mode);

        let currentPrice = retail;
        let usedMyDiscountRub = 0;
        let usedPromoCodeRub = 0;

        if (limits.allowPromo) {
            // --- Сценарий: Моя Скидка ---
            if (mode === CalculationMode.MY_DISCOUNT && input.prices.myDiscountValue > 0) {
                const potentialPrice = retail - input.prices.myDiscountValue;
                const minPriceAllowed = catalog * (1 - limits.totalLimitPercent / 100);

                if (potentialPrice >= minPriceAllowed) {
                    usedMyDiscountRub = input.prices.myDiscountValue;
                    currentPrice = potentialPrice;
                } else {
                    currentPrice = Math.max(potentialPrice, minPriceAllowed);
                    usedMyDiscountRub = retail - currentPrice;
                }
            }
            // --- Сценарий: Промокод ---
            else if (mode === CalculationMode.PROMO_CODE) {
                // Берем процент из инпута или дефолтный 10%
                const promoPercent = input.promoCodePercent || 10;

                const discountAmount = retail * (promoPercent / 100);
                const potentialPrice = retail - discountAmount;
                const minPriceAllowed = catalog * (1 - limits.totalLimitPercent / 100);

                if (potentialPrice >= minPriceAllowed) {
                    usedPromoCodeRub = Math.floor(discountAmount);
                    currentPrice -= usedPromoCodeRub;
                } else {
                    const clampedPrice = Math.ceil(minPriceAllowed);
                    if (currentPrice > clampedPrice) {
                        currentPrice = clampedPrice;
                        usedPromoCodeRub = retail - currentPrice;
                    } else {
                        usedPromoCodeRub = 0;
                    }
                }
            }
        }

        // Логика бонусов
        let usedBonusesRub = 0;
        if (limits.allowBonuses) {
            const maxBonusesByPercent = currentPrice * (limits.bonusLimitPercent / 100);
            const minPriceAllowed = catalog * (1 - limits.totalLimitPercent / 100);
            const roomToFloor = Math.max(0, currentPrice - minPriceAllowed);
            const bonusesToUse = Math.min(maxBonusesByPercent, roomToFloor);

            usedBonusesRub = Math.floor(bonusesToUse);
            currentPrice -= usedBonusesRub;
        }

        const finalPrice = Math.ceil(currentPrice);
        const totalDiscountPercent = ((catalog - finalPrice) / catalog) * 100;
        const totalCalculatorSavingsRub = input.prices.retail - finalPrice;

        return {
            finalPrice,
            usedMyDiscountRub,
            usedPromoCodeRub,
            usedBonusesRub,
            totalDiscountPercent: Number(totalDiscountPercent.toFixed(2)),
            totalCalculatorSavingsRub,
            limits: {
                appliedTotalLimitPercent: Number(limits.totalLimitPercent.toFixed(2)),
                appliedBonusLimitPercent: limits.bonusLimitPercent,
            },
            mode,
        };
    }

    private static determineLimits(input: CalculatorInput, mode: CalculationMode) {
        const { flags, prices, constraints } = input;

        let totalLimitPercent = constraints.explicitTotalLimitPercent ?? this.BASE_MAX_TOTAL_DISCOUNT;
        const bonusLimitPercent = constraints.explicitBonusLimitPercent ?? this.BASE_BONUS_PERCENT;

        let allowPromo = true;
        let allowBonuses = true;

        // --- Блокировки (Global) ---
        if (flags.isBestPrice || flags.isFinalPrice) {
            return { totalLimitPercent: 0, bonusLimitPercent: 0, allowPromo: false, allowBonuses: false };
        }
        if (flags.isOfferOfWeek) {
            allowPromo = false;
        }
        if (flags.isSpecialCondition) {
            allowPromo = false;
        }
        if (mode === CalculationMode.BONUS_ONLY) {
            allowPromo = false;
        }

        // --- Блокировка Промокода при "Условия бонусов" ---
        // Если есть "Условия бонусов", то промокоды запрещены.
        // (Моя скидка обычно всё равно работает, если сервер её прислал, но промокод блокируем)
        if (flags.isBonusCondition && mode === CalculationMode.PROMO_CODE) {
            allowPromo = false;
        }

        // --- Текущее состояние ---
        const currentStoreDiscountPercent = ((prices.catalog - prices.retail) / prices.catalog) * 100;
        const EPSILON = 0.01;

        // --- Расширение лимитов ---

        // 1. My Discount
        if (mode === CalculationMode.MY_DISCOUNT && prices.myDiscountValue > 0) {
            const myDiscountPercent = (prices.myDiscountValue / prices.catalog) * 100;
            const requiredLimit = currentStoreDiscountPercent + myDiscountPercent;
            if (requiredLimit > totalLimitPercent) {
                totalLimitPercent = requiredLimit;
            }
        }
        // 2. Promo Code (Нет расширения)
        else if (mode === CalculationMode.PROMO_CODE) {
            // Лимит не меняем
        }

        // --- Валидация потолка ---
        if (currentStoreDiscountPercent >= totalLimitPercent - EPSILON) {
            allowPromo = false;
        }

        const baseLimitToCheck = constraints.explicitTotalLimitPercent ?? this.BASE_MAX_TOTAL_DISCOUNT;
        if (currentStoreDiscountPercent >= baseLimitToCheck - EPSILON) {
            allowBonuses = false;
        }

        return {
            totalLimitPercent,
            bonusLimitPercent,
            allowPromo,
            allowBonuses,
        };
    }
}
