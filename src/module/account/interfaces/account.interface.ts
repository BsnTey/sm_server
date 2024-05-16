import { Account, Proxy } from '@prisma/client';

export interface IRefreshAccount {
    accessToken: string;
    refreshToken: string;
    expiresIn: Date;
}

export interface IAccountCashing {
    accountId: string;
    requestId: string;
    [key: string]: string;
}

export interface IAccountWithProxy extends Account {
    proxy: Proxy | null;
}
