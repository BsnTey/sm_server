import { Account, CitySM, Proxy } from '@prisma/client';

export interface IRefreshAccount {
    accessToken: string;
    refreshToken: string;
    expiresInAccess: Date;
    expiresInRefresh: Date;
}

export interface IAccountCashing {
    accountId: string;
    requestId: string;
    [key: string]: string;
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
