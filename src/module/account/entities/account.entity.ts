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
    expiresIn: Date;
    bonusCount: number;
    isAccessMp: boolean;
    isAccessCookie: boolean;
    isOnlyAccessOrder: boolean;
    isUpdateBonus: boolean;
    ownerTelegramId: string;
    proxyUuid: string | null; //что вернет, если прокси будет у аккаунта
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
        if (this.expiresIn && oneHourNext < this.expiresIn) {
            console.log('Не обновлял по времени');
            return false;
        }
        console.log('Иду обновлять по истечению времени');
        return true;
    }

    // setProxy(proxy: string) {
    //     this.proxy = proxy;
    // }

    setCity(cityId: string, cityName: string): void {
        this.cityId = cityId;
        this.cityName = cityName;
    }
}
