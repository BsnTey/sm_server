import { Account, CitySM, CourseStatus, Proxy } from '@prisma/client';
import { SearchProductInterface } from './search-product.interface';
import { CartInterface } from './cart.interface';
import { PickupAvabilityInterface, Shop } from './pickup-avability.interface';
import { IItemsCart } from '../../telegram/utils/cart.utils';

export interface IRefreshAccount {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
}

export interface ICourseTokens {
    userGateToken: string;
    accessTokenCourse: string;
    refreshTokenCourse: string;
    isValidAccessTokenCourse: boolean;
}

export interface ICourseStatus {
    statusCourse: CourseStatus;
}

export interface IRefreshDataAccount {
    accessToken: string;
    refreshToken: string;
    expiresInAccess: Date;
    expiresInRefresh: Date;
}

export interface IUpdateAccount {
    accessToken: string;
    refreshToken: string;
    xUserId: string;
    deviceId: string;
    installationId: string;
    expiresInAccess: Date;
    expiresInRefresh: Date;
    isAccessMp: boolean;
    userGateToken: string | null;
    statusCourse: CourseStatus;
    accessTokenCourse: string;
    refreshTokenCourse: string;
    isValidAccessTokenCourse: boolean;
}

export interface IEmailFromDb {
    email: string;
    passImap: string;
    passEmail: string;
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
