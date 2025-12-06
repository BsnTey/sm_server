import { Injectable } from '@nestjs/common';
import { aproveShopKeyboard, comebackShopSelection } from '../../keyboards/make-order.keyboard';
import { AddressSuggestList } from '../../../account/interfaces/account.interface';
import { OrderState } from '../../interfaces/order.interface';

export type FormatGeo = {
    id: string;
    title: string;
    uri: string;
};

@Injectable()
export class MakeOrderService {
    constructor() {}

    async approveShop(account: OrderState, shopId: string) {
        const accessItemsPickupAvailability = account.accessItemsPickupAvailability;
        const shop = accessItemsPickupAvailability?.data.list.find(shop => String(shop.shop.shopNumber) === shopId);

        if (!shop) {
            return {
                text: 'Магазин не найден',
                keyboard: comebackShopSelection,
                shop: null,
            };
        }

        const selectedShop = shop;
        const isAllAvailabilityItems = selectedShop.potentialOrders[0].availability === 'IN_STOCK';

        if (isAllAvailabilityItems) {
            return {
                text: `Подтвердите выбор ТЦ по адресу:\n${selectedShop.shop.address}\n${selectedShop.shop.name}`,
                keyboard: aproveShopKeyboard,
                shop: selectedShop.shop,
            };
        }

        const partAvailabilityItems = selectedShop.potentialOrders[1];
        const cart = account.cartResponse!;
        const text =
            'Сегодня доступны вещи:\n' +
            partAvailabilityItems.availableItems
                .map(item => {
                    const itemProductId = item.productId;
                    const availableItem = cart.data.cartFull.availableItems.find(
                        productId => productId.cartItemId.productId === itemProductId,
                    );
                    return availableItem!.name;
                })
                .join('\n');

        return {
            text: text,
            keyboard: comebackShopSelection,
            shop: null,
        };
    }

    formatGeo(addressSuggestList: AddressSuggestList[]): FormatGeo[] {
        return addressSuggestList.map(i => {
            const id = 'id' + Math.random().toString(16).slice(2);
            return {
                id,
                title: i.title.text,
                uri: i.uri,
            };
        });
    }
}
