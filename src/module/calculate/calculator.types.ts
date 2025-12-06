/**
 * DTO - Единый формат данных для входа в калькулятор.
 * Неважно, откуда пришли данные (сайт, приложение, API),
 * адаптер должен привести их к этому виду.
 *
 * @shared - Этот файл идентичен на клиенте и бэкенде.
 */
export interface CalculatorInput {
    prices: {
        catalog: number; // Цена до скидок (зачеркнутая), в рублях
        retail: number; // Текущая цена на витрине, в рублях
        myDiscountValue: number; // Значение "Моей скидки" в рублях (если есть, иначе 0)
        myDiscountPercent?: number; // В процентах (ручной ввод)
    };
    flags: {
        isBestPrice: boolean; // Плашка "Лучшая цена"
        isFinalPrice: boolean; // Плашка "Финальная цена"
        isOfferOfWeek: boolean; // Плашка "Предложение недели"
        isPriceReduced: boolean; // Плашка "Цена снижена"
        isSpecialCondition: boolean; // Плашка "Особые условия"
        isBonusCondition: boolean; // Плашка: "Условия бонусов"
        isBonus20: boolean; // Плашка "До 20%"
    };
    constraints: {
        explicitBonusLimitPercent: number | null; // Если явно написано "до 20% бонусами"
        explicitTotalLimitPercent: number | null; // Если явно написано "суммарно не более 30%"
    };
    promoCodePercent?: number;
}

export interface CalculationResult {
    finalPrice: number; // Итоговая цена к оплате
    usedMyDiscountRub: number; // Сколько списано по "Моей скидке"
    usedBonusesRub: number; // Сколько списано бонусов
    usedPromoCodeRub: number; // Сколько списано промокодом
    totalDiscountPercent: number; // Итоговый процент скидки от Catalog цены
    limits: {
        appliedTotalLimitPercent: number; // Какой лимит общей скидки был применен (50, 58, 60...)
        appliedBonusLimitPercent: number; // Какой лимит списания бонусов был применен (30, 20, 10...)
    };
    mode: CalculationMode;
}

export enum CalculationMode {
    BONUS_ONLY = 'BONUS_ONLY', // Только баллы (без промо и моей скидки)
    PROMO_CODE = 'PROMO_CODE', // Промокод (обычно 10-15%) + Баллы
    MY_DISCOUNT = 'MY_DISCOUNT', // Моя скидка + Баллы
}
