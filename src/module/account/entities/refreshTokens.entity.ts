import { IRefreshAccount, IRefreshDataAccount } from '../interfaces/account.interface';

export class RefreshTokensEntity implements IRefreshDataAccount {
    accessToken: string;
    refreshToken: string;
    expiresInAccess: Date;
    expiresInRefresh: Date;

    constructor(tokens: IRefreshAccount) {
        const expiresInTimestamp = Date.now() + +tokens.expiresIn * 1000;
        const expiresInDateAccess = new Date(expiresInTimestamp);

        const now = new Date();
        const expiresInRefresh = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        this.accessToken = tokens.accessToken;
        this.refreshToken = tokens.refreshToken;
        this.expiresInAccess = expiresInDateAccess;
        this.expiresInRefresh = expiresInRefresh;

        Object.assign(this, tokens);
        return this;
    }
}
