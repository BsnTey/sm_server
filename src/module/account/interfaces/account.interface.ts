import { Account, CitySM, CourseStatus, Proxy } from '@prisma/client';
import { SearchProductInterface } from './search-product.interface';
import { CartInterface } from './cart.interface';
import { PickupAvabilityInterface, Shop } from './pickup-avability.interface';
import { IItemsCart } from '../../telegram/utils/cart.utils';
import { IDeviceInfo } from './deviceInfo.interface';
import { AccountWithProxyEntity } from '../entities/accountWithProxy.entity';
import { Location } from './geo.interface';
import { FormatGeo } from '../../telegram/updates/make-order/make-order.service';

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

export interface AccountWDevice extends Account {
    deviceInfo: IDeviceInfo | null;
}

export interface IEmailFromDb {
    email: string;
    passImap: string;
    passEmail: string;
}

export interface IAccountCashing {
    accountId: string;
    geo: FormatGeo[];
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

export interface IAccountWithProxyFromDB extends Account {
    proxy: Proxy | null;
    citySM: CitySM;
}

export interface IAccountWithProxy extends Account {
    proxy: Proxy;
    citySM: CitySM;
}

export interface AddressSuggestList {
    title: Title;
    subtitle?: Subtitle;
    tags: string[];
    formattedAddress: string;
    uri: string;
}

export interface Subtitle {
    text: string;
    hl: Hl[];
}

export interface Title {
    text: string;
    hl?: Hl[];
}

export interface Hl {
    begin: number;
    end: number;
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

export type GetAccountOpts = {
    ensureXLocation?: boolean;
};

export type ResolvedCity = {
    account: AccountWithProxyEntity;
    city: CitySM;
    location: Location;
};
