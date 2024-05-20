import { CartInterface } from '../../account/interfaces/cart.interface';

export interface IItemsCart {
    sku: string;
    productId: string;
    name?: string;
    linesIds?: string[];
}

export function selectMainFromCart(cart: CartInterface): IItemsCart[] {
    const items = cart.data.cartFull.availableItems;
    const itemsDelivery = cart.data.cartFull.obtainPoints;
    const itemsOutStock = cart.data.cartFull.soldOutLines;

    if (itemsDelivery.length > 0) {
        const itemsTemp = itemsDelivery[0].cartItems[0];
        items.push(itemsTemp);
    }

    if (itemsOutStock.length > 0) {
        items.push(...itemsOutStock);
    }

    return items.map(item => ({
        sku: String(item.cartItemId.sku),
        productId: item.cartItemId.productId,
        linesIds: item.cartItemId.linesIds,
        name: item.name,
    }));
}

export function getTextCart(cart: CartInterface): string {
    let text = '\n';
    const unallocatedItems = cart.data.cartFull.availableItems;
    unallocatedItems.forEach(item => {
        text += `Название товара: ${item.name}\n`;
        text += `Количество товара: ${item.quantity}\n`;

        item.params.forEach(param => {
            text += `${param.name}: ${param.value}\n`;
        });

        const itemPrice = item.itemPrice.value / 100;
        const catalogPrice = item.catalogPrice.value / 100;
        text += `Цена товара с учетом скидки: ${Math.floor(itemPrice)}\n`;
        text += `Цена товара без учета скидки: ${Math.floor(catalogPrice)}\n\n`;
    });

    text += '\nОбщая информация по заказу:\n';
    const totals = cart.data.cartFull.totals;
    const productsAmount = Math.floor(totals.productsAmount);
    const priceWoDiscount = Math.floor(totals.priceWoDiscount.value / 100);
    const bonuses = Math.floor(totals.bonuses.value / 100);
    const promo = Math.floor(totals.promo.value / 100);
    const total = Math.floor(totals.total.value / 100);
    const promocodes: string[] = cart.data.cartFull.promoCodes;

    text += `Использовать бонусы?: ${cart.data.cartFull.bonusesInfo.bonusApplied ? 'ДА' : 'НЕТ'}\n`;
    text += `Применены ли бонусы к заказу?: ${cart.data.cartFull.bonusesInfo.isBonusAvailable ? 'ДА' : 'НЕТ'}\n`;
    text += `Использованные промокоды: ${promocodes.length > 0 ? promocodes[0] : 'НЕТ'}\n`;
    text += `Количество товаров в корзине: ${productsAmount}\n`;
    text += `Цена товаров без всех скидок: ${priceWoDiscount}\n`;
    text += `Количество примененных бонусов: ${bonuses}\n`;
    text += `Скидка по промо: ${promo}\n\n`;
    text += `Итоговая цена со всеми скидками: ${total}\n`;

    return text;
}
