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

        const catalog = product.price.catalog.value / 100;
        const retail = product.price.retail.value / 100;

        const myDiscountItem = product.personalPrice?.discountList?.find(x => x.actionName?.toLowerCase() === 'моя скидка');
        const myDiscountValue = myDiscountItem ? myDiscountItem.summa.value / 100 : 0;

        const flags = {
            isBestPrice: markers.some(m => m.title === 'Лучшая цена'),
            isFinalPrice: markers.some(m => m.title === 'Финальная цена'),
            isOfferOfWeek: markers.some(m => m.title === 'Предложение недели'),
            isPriceReduced: markers.some(m => m.title === 'Цена снижена'),
            isSpecialCondition: markers.some(m => m.title === 'Особые условия'),
            isBonusCondition: markers.some(m => m.title === 'Условия бонусов'),
            isBonus20: markers.some(m => {
                const t = (m.title || '').toLowerCase();
                return t.includes('бонусами') && !t.includes('вернем') && !t.includes('начислим');
            }),
        };

        const constraints = this.parseConstraints(markers, flags);

        return {
            prices: { catalog, retail, myDiscountValue },
            flags,
            constraints,
        };
    }

    /**
     * Парсит ограничения из маркеров товара
     */
    private static parseConstraints(
        markers: Marker[],
        flags: { isBonus20: boolean; isFinalPrice: boolean; isBestPrice: boolean },
    ): {
        explicitBonusLimitPercent: number | null;
        explicitTotalLimitPercent: number | null;
    } {
        let explicitBonusLimitPercent: number | null = null;
        let explicitTotalLimitPercent: number | null = null;

        const conditionsMarker = markers.find(m => m.title === 'Условия бонусов');
        if (conditionsMarker?.description) {
            const match = conditionsMarker.description.match(/до\s+(\d+)%/i);
            if (match?.[1]) {
                explicitBonusLimitPercent = parseInt(match[1], 10);
            }
        }

        if (explicitBonusLimitPercent === null) {
            const specialMarker = markers.find(m => m.title === 'Особые условия');
            if (specialMarker?.description) {
                const match = specialMarker.description.match(/(\d+)%/);
                if (match?.[1]) {
                    explicitBonusLimitPercent = parseInt(match[1], 10);
                }
            }
        }

        if (explicitBonusLimitPercent === null) {
            for (const m of markers) {
                const title = m.title || '';

                if (/вернем|начислим|кэшбэк/i.test(title)) continue;

                if (title.toLowerCase().includes('бонусами')) {
                    const bonusMatch = title.match(/До\s+(\d+)%/i);
                    if (bonusMatch?.[1]) {
                        explicitBonusLimitPercent = parseInt(bonusMatch[1], 10);

                        if (m.description) {
                            const totalMatch = m.description.match(/не\s+более\s+(\d+)%/i);
                            if (totalMatch?.[1]) {
                                explicitTotalLimitPercent = parseInt(totalMatch[1], 10);
                            }
                        }
                        break;
                    }
                }
            }
        }

        if (flags.isBonus20 && explicitBonusLimitPercent === null) {
            explicitBonusLimitPercent = 20;
            if (explicitTotalLimitPercent === null) {
                explicitTotalLimitPercent = 30;
            }
        }

        if (flags.isFinalPrice || flags.isBestPrice) {
            explicitBonusLimitPercent = 0;
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
