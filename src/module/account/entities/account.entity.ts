import { Account } from '@prisma/client';

export class AccountEntity implements Account {
    accountId: string;
    email: string;
    passImap: string;
    passEmail: string;
    cookie: string;
    accessToken: string;
    refreshToken: string;
    xUserId: string;
    deviceId: string;
    installationId: string;
    googleId: string | null;
    pushToken: string | null;
    expiresInAccess: Date;
    expiresInRefresh: Date;
    bonusCount: number;
    isAccessMp: boolean;
    isAccessCookie: boolean;
    isOnlyAccessOrder: boolean;
    isUpdateBonus: boolean;
    ownerTelegramId: string;
    proxyUuid: string | null;
    cityId = '1720920299';
    cityName = 'Москва';

    createdAt: Date;
    updatedAt: Date;

    constructor(account: Partial<Account>) {
        Object.assign(this, account);
        return this;
    }

    updateTokensByTime() {
        const nowDate = new Date();
        const oneHourNext = new Date(nowDate.getTime() + 60 * 60 * 1000);
        if (this.expiresInAccess && oneHourNext < this.expiresInAccess) {
            return false;
        }
        return true;
    }

    setCity(cityId: string, cityName: string): void {
        this.cityId = cityId;
        this.cityName = cityName;
    }
}
