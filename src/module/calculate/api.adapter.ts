import { CalculatorInput } from './calculator.types';
import { ProductApiResponse } from '../account/interfaces/product.interface';

type Marker = ProductApiResponse['product']['markers'][number];

/**
 * Адаптер для преобразования API-ответа в формат калькулятора.
 * Используется ТОЛЬКО на бэкенде.
 */
export class ApiAdapter {
    /**
     * Преобразует ProductApiResponse['product'] в CalculatorInput
     */
    static parseCalculatorInput(product: ProductApiResponse['product']): CalculatorInput {
        const markers = product.markers || [];

        // Цены (конверсия из копеек в рубли)
        const catalog = product.price.catalog.value / 100;
        const retail = product.price.retail.value / 100;

        // Моя скидка
        const myDiscountItem = product.personalPrice?.discountList?.find(x => x.actionName?.toLowerCase() === 'моя скидка');
        const myDiscountValue = myDiscountItem ? myDiscountItem.summa.value / 100 : 0;

        // Флаги (определение плашек по title маркера)
        const flags = {
            isBestPrice: markers.some(m => m.title === 'Лучшая цена'),
            isFinalPrice: markers.some(m => m.title === 'Финальная цена'),
            isOfferOfWeek: markers.some(m => m.title === 'Предложение недели'),
            isPriceReduced: markers.some(m => m.title === 'Цена снижена'),
            isSpecialCondition: markers.some(m => m.title === 'Особые условия'),
            isBonusCondition: markers.some(m => m.title === 'Условия бонусов'),
            isBonus20: markers.some(m => m.title?.includes('бонусами')),
        };

        // Ограничения (парсинг из description маркеров)
        const constraints = this.parseConstraints(markers);

        return {
            prices: { catalog, retail, myDiscountValue },
            flags,
            constraints,
        };
    }

    /**
     * Парсит ограничения из маркеров товара
     */
    private static parseConstraints(markers: Marker[]): {
        explicitBonusLimitPercent: number | null;
        explicitTotalLimitPercent: number | null;
    } {
        let explicitBonusLimitPercent: number | null = null;
        let explicitTotalLimitPercent: number | null = null;

        // 1. Условия бонусов (строгое ограничение)
        const conditionsMarker = markers.find(m => m.title === 'Условия бонусов');
        if (conditionsMarker?.description) {
            const match = conditionsMarker.description.match(/до\s+(\d+)%/i);
            if (match?.[1]) {
                explicitBonusLimitPercent = parseInt(match[1], 10);
            }
        }

        // 2. Особые условия
        const specialMarker = markers.find(m => m.title === 'Особые условия');
        if (specialMarker?.description) {
            const match = specialMarker.description.match(/(\d+)%/);
            if (match?.[1] && explicitBonusLimitPercent === null) {
                explicitBonusLimitPercent = parseInt(match[1], 10);
            }
        }

        // 3. Стандартная плашка бонусов "До X% бонусами"
        if (explicitBonusLimitPercent === null) {
            const bonusMarker = markers.find(m => m.title?.includes('бонусами'));
            if (bonusMarker) {
                // Лимит бонусов из заголовка
                const bonusMatch = bonusMarker.title?.match(/(\d+)%/);
                if (bonusMatch?.[1]) {
                    explicitBonusLimitPercent = parseInt(bonusMatch[1], 10);
                }

                // Общий лимит из описания "не более X%"
                if (bonusMarker.description) {
                    const totalMatch = bonusMarker.description.match(/не\s+более\s+(\d+)%/i);
                    if (totalMatch?.[1]) {
                        explicitTotalLimitPercent = parseInt(totalMatch[1], 10);
                    }
                }
            }
        }

        return { explicitBonusLimitPercent, explicitTotalLimitPercent };
    }

    /**
     * Вычисляет процент "Моей скидки" от каталожной цены
     */
    static calcMyDiscountPercent(product: ProductApiResponse['product']): number {
        const list = product?.personalPrice?.discountList ?? [];
        const myDiscountItem = list.find(x => x?.actionName?.toLowerCase() === 'моя скидка');

        const catalogVal = product.price.catalog.value;
        if (!myDiscountItem || !catalogVal) return 0;

        const summaDiscount = myDiscountItem.summa.value / 100;
        const priceCatalog = catalogVal / 100;

        return Number(((summaDiscount / priceCatalog) * 100).toFixed(1));
    }
}
