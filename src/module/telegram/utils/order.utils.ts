import { CartInterface } from '../../account/interfaces/cart.interface';
import { IItemsCart } from './cart.utils';

export const isAccessShop = (cart: CartInterface): string[] => {
    const availableItems = cart.data.cartFull.availableItems;
    const unAccessItemsOrder: string[] = [];

    for (const item of availableItems) {
        const name = item.name;
        const deliveryInfo = item.deliveryInfo;
        const onlyIntPickup = deliveryInfo.onlyIntPickup;
        const isExpressDeliveryEnabled = deliveryInfo.isExpressDeliveryEnabled;
        const isDeliveryServicesEnabled = deliveryInfo.isDeliveryServicesEnabled;

        if (!(onlyIntPickup || isExpressDeliveryEnabled || isDeliveryServicesEnabled)) unAccessItemsOrder.push(name);
    }
    return unAccessItemsOrder;
};

export const refactorNonAccessItems = (resultList: string[]) => {
    return resultList.join(', ');
};

export const prepareForInternalPickupAvailability = (itemsCart: CartInterface): IItemsCart[] => {
    const newItems: IItemsCart[] = [];

    for (const item of itemsCart.data.cartFull.availableItems) {
        const newItem: IItemsCart = {
            productId: item.cartItemId.productId,
            sku: String(item.cartItemId.sku),
            linesIds: item.cartItemId.linesIds,
        };
        newItems.push(newItem);
    }
    return newItems;
};

// const availability = { SUPPLY: 'Под доставку', IN_STOCK: 'В наличии' };
//
// export const refactorShopAddress = (shops: ShopType[]): ShopAddressType => {
//     const shopAdd: ShopAddressType = {};
//
//     for (const shop of shops) {
//         const shopId = shop.shop.shopNumber;
//         const name = shop.shop.name;
//         const shopAddress = shop.shop.address;
//         shopAdd[shopId] = {
//             shopAddress,
//             name,
//             availability: availability[shop.availability],
//         };
//     }
//     return shopAdd;
// };
