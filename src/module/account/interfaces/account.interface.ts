export type RefreshByType = 'shortInfo' | 'detailsBonus' | 'promocode';

export interface IRefreshAccount {
    accessToken: string;
    refreshToken: string;
    expiresIn: Date;
}

export interface IAccountCashing {
    accountId: string;
    [key: string]: string;
}
