import { Markup } from 'telegraf';
import { CitySMEntity } from '../../account/entities/citySM.entity';
import { CartInterface } from '../../account/interfaces/cart.interface';
import { SearchProductInterface } from '../../account/interfaces/search-product.interface';
import { PickupAvabilityInterface } from '../../account/interfaces/pickup-avability.interface';
import { OrdersInterface } from '../../account/interfaces/orders.interface';

export const mainMenuOrderKeyboard = (city: string) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback(`Изменить город: ${city}`, 'go_to_city')],
        [Markup.button.callback(`Перейти в корзину`, 'go_to_cart')],
        [Markup.button.callback(`Перейти к заказам`, 'go_to_orders')],
    ]);
};

export const getCitiesKeyboard = (cities: CitySMEntity[]) => {
    return Markup.inlineKeyboard([
        ...cities.map(city => {
            return [Markup.button.callback(`${city.fullName}`, `id_city_${city.cityId}`)];
        }),
        [Markup.button.callback('Назад', 're_enter_scene')],
    ]);
};

export const getCitiesForDeleteKeyboard = (cities: CitySMEntity[]) => {
    return Markup.inlineKeyboard([
        ...cities.map(city => {
            return [Markup.button.callback(`${city.name}`, `del_city_${city.cityId}`)];
        }),
        [Markup.button.callback('Назад', 're_enter_scene')],
    ]);
};

export const getFoundedCitiesForFavKeyboard = (cities: CitySMEntity[]) => {
    return Markup.inlineKeyboard([
        ...cities.map(city => {
            return [Markup.button.callback(`${city.fullName}`, `add_favourite_city_${city.cityId}`)];
        }),
        [Markup.button.callback('Назад', 'go_back')],
    ]);
};

export const getUserCitiesKeyboard = (userCities: CitySMEntity[]) => {
    const btns = [
        [Markup.button.callback('Добавить город в избранное', 'add_new_user_city')],
        ...userCities.map(city => {
            return [Markup.button.callback(`${city.name}`, `id_city_${city.cityId}`)];
        }),
        userCities.length != 0 ? [Markup.button.callback('Удалить город из избранного', 'del_favourite_city')] : [],
        [Markup.button.callback('Вернуться в меню', 'go_to_menu')],
    ];
    return Markup.inlineKeyboard(btns);
};

export const comebackBtn = Markup.inlineKeyboard([[Markup.button.callback('Назад', 'go_back')]]);

export const cartItemsKeyboard = (cartItems: CartInterface) => {
    const keyboard = [];
    const items = cartItems.data.cartFull.availableItems;
    for (const item of items) {
        keyboard.push([Markup.button.callback(item.name, `id_remove_${item.cartItemId.productId}_${item.cartItemId.sku}`)]);
    }

    keyboard.push(
        [Markup.button.callback('Добавить товар', 'add_item_cart')],
        [Markup.button.callback('Внести корзину по ссылке', 'add_order_link')],
        [Markup.button.callback('Поделиться корзиной', 'share_cart'), Markup.button.callback('Очистить корзину', 'clear_cart')],
        [Markup.button.callback('Добавить промокод', 'add_promo'), Markup.button.callback('Удалить промокод', 'delete_promo')],
        [Markup.button.callback('Перейти к выбору ТЦ', 'shop_selection')],
        [Markup.button.callback('Вернуться в меню', 'go_to_menu')],
    );

    return Markup.inlineKeyboard(keyboard);
};

export const emptyCartKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Добавить товар', 'add_item_cart')],
    [Markup.button.callback('Внести корзину по ссылке', 'add_order_link')],
    [
        Markup.button.callback('Доб. Пакет', 'id_add_23748420299_41707140299'),
        Markup.button.callback('Доб. Батончик', 'id_add_29280430299_51691400299'),
        Markup.button.callback('Доб. Б.Пакет', 'id_add_23748410299_41707130299'),
    ],
    [Markup.button.callback('Вернуться в меню', 'go_to_menu')],
]);

export function getSearchProductKeyboard(searchProduct: SearchProductInterface) {
    const list = searchProduct.data.list;

    return Markup.inlineKeyboard([
        ...list.map(item => {
            return [Markup.button.callback(`${item.name}`, `id_product_${item.id}`)];
        }),
        [Markup.button.callback('Назад', 'go_back')],
    ]);
}

export function getSearchSkuKeyboard(productId: string, searchProduct: SearchProductInterface) {
    const list = searchProduct.data.list;
    const item = list.filter(value => value.id == productId)[0];
    const skus = item.skus;

    const availableSkus = skus.filter(item => item.availability.isOnlineAvailable);
    if (availableSkus.length == 0) return null;

    return Markup.inlineKeyboard([
        ...availableSkus.map(item => {
            return [Markup.button.callback(`${item.sizes[1].value} ${item.sizes[1].name || ''}`, `id_add_${productId}_${item.id}`)];
        }),
        [Markup.button.callback('Назад', 'go_back')],
    ]);
}

const availability = { SUPPLY: 'Под Заказ', IN_STOCK: 'В наличии' };
export const comebackShopSelection = Markup.inlineKeyboard([[Markup.button.callback('Назад', 'shop_selection')]]);

export const accessShopsKeyboard = (avabilityShops: PickupAvabilityInterface) => {
    const shops = avabilityShops.data.list;
    const keyboard = [];
    for (const shop of shops) {
        // const shop = shops[shopKey];
        const avabilityShop = shop.potentialOrders[0].availability;
        keyboard.push([
            Markup.button.callback(
                `${shop.shop.name} ${availability[avabilityShop as keyof typeof availability]}`,
                `id_shop_${shop.shop.shopNumber}`,
            ),
        ]);
    }
    keyboard.push([Markup.button.callback('Назад', 'shop_selection')]);
    return Markup.inlineKeyboard(keyboard);
};

export const aproveShopKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback(`Подтвердить`, `approve_shop`)],
    [Markup.button.callback(`Вернуться назад`, 'shop_selection')],
]);

export const recipientKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback(`Изменить получателя`, `recipient_not_i`)],
    [Markup.button.callback(`Оставить из профиля`, 'recipient_i')],
]);

export const ordersInfoKeyboard = Markup.inlineKeyboard([[Markup.button.callback(`Перейти к заказам`, `go_to_orders`)]]);

export const comebackCartkeyboard = Markup.inlineKeyboard([[Markup.button.callback('Вернуться в корзину', 'go_to_cart')]]);

export const orderHistoryKeyboard = (orders: OrdersInterface) => {
    const keyboard = [];
    for (const order of orders.data.orders) {
        keyboard.push([
            Markup.button.callback(`${order.number} ${order.status.statusText} ${order.receiptCode || ''}`, `order_${order.number}`),
        ]);
    }
    keyboard.push([Markup.button.callback(`Вернуться в меню`, `go_to_menu`)]);
    return Markup.inlineKeyboard(keyboard);
};

export const infoOrderKeyboard = (accountId: string, orderNumber: string, isCancelled: boolean, DOMAIN: string) => {
    const keyboard = [];

    !isCancelled && keyboard.push([Markup.button.callback(`Отменить заказ`, `cancelled_order_${orderNumber}`)]);

    keyboard.push([Markup.button.callback(`Вернуться к заказам`, `go_to_orders`)]);
    keyboard.push([Markup.button.url(`Посмотреть заказ на сайте`, `${DOMAIN}/api/order/${accountId}/${orderNumber}`)]);

    return Markup.inlineKeyboard(keyboard);
};
