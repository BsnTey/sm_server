import { FormatGeo } from '../updates/make-order/make-order.service';
import { IItemsCart } from '../utils/cart.utils';
import { PickupAvabilityInterface, Shop } from '../../account/interfaces/pickup-avability.interface';
import { CartInterface } from '../../account/interfaces/cart.interface';
import { SearchProductInterface } from '../../account/interfaces/search-product.interface';

export interface OrderState {
    accountId: string;
    geo?: FormatGeo[];
    email?: string;
    cartResponse?: CartInterface;
    shop?: Shop;
    internalPickupAvabilityItems?: IItemsCart[];
    accessItemsPickupAvailability?: PickupAvabilityInterface;
    version?: string;
    potentialOrder?: string;
    foundedProduct?: SearchProductInterface;
}
