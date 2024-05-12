export type RefreshByType = 'shortInfo' | 'detailsBonus' | 'promocode';

export interface IRefreshAccount {
    accessToken: string;
    refreshToken: string;
    expiresIn: Date;
}
