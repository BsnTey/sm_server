import { Account } from '@prisma/client';
import { Cookie } from '../interfaces/cookie.interface';

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
    userGateToken: string | null;
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
    cityName? = 'Москва';

    createdAt: Date;
    updatedAt: Date;

    constructor(account: Partial<Account>) {
        account = {
            ...account,
            cookie: this.formatedCookie(account.cookie!),
        };
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

    private formatedCookie(cookieString: string) {
        const cookieInJson: any[] = JSON.parse(cookieString);
        const smid = cookieInJson.find(cookie => {
            if (cookie.name == 'SMID') return true;
        });

        const cookieObject: Cookie[] = [
            {
                domain: 'www.sportmaster.ru',
                hostOnly: true,
                httpOnly: true,
                name: 'SMID',
                path: '/',
                sameSite: 'lax',
                secure: false,
                session: false,
                storeId: null,
                value: smid.value,
            },
        ];

        return JSON.stringify(cookieObject);
    }
}
