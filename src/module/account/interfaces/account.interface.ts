import { Account, CitySM, Proxy } from '@prisma/client';
import { SearchProductInterface } from './search-product.interface';
import { CartInterface } from './cart.interface';
import { PickupAvabilityInterface, Shop } from './pickup-avability.interface';
import { IItemsCart } from '../../telegram/utils/cart.utils';

export interface IRefreshAccount {
    accessToken: string;
    refreshToken: string;
    expiresInAccess: Date;
    expiresInRefresh: Date;
}

export interface IAccountCashing {
    accountId: string;
    email: string;
    requestId: string;
    foundedProduct?: SearchProductInterface;
    cartResponse?: CartInterface;
    accessItemsPickupAvailability: PickupAvabilityInterface;
    internalPickupAvabilityItems: IItemsCart[];
    shop?: Shop;
    version?: string;
    potentialOrder?: string;
    // [key: string]: string;
}

export interface IAccountWithProxy extends Account {
    proxy: Proxy | null;
    citySM: CitySM;
}

export interface IFindCitiesAccount {
    id: string;
    name: string;
    fullName: string;
    eutc: string;
    macrocityId: string;
    hasMetro: boolean;
}

export interface IRecipient {
    firstName: string;
    lastName: string;
    number: string;
    email: string;
}

export interface IRecipientOrder extends IRecipient {
    potentialOrder: string;
}
