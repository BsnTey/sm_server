import { Account, CourseStatus } from '@prisma/client';

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
    statusCourse: CourseStatus;
    accessTokenCourse: string | null;
    refreshTokenCourse: string | null;
    isValidAccessTokenCourse: boolean;
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
        return !(this.expiresInAccess && oneHourNext < this.expiresInAccess);
    }

    setCity(cityId: string, cityName: string): void {
        this.cityId = cityId;
        this.cityName = cityName;
    }

    private formatedCookie(cookieString: string) {
        return cookieString;

        // const cookieInJson: any[] = JSON.parse(cookieString);
        // const smid = cookieInJson.find(cookie => {
        //     if (cookie.name == 'SMID') return true;
        // });
        //
        // const cookieObject: Cookie[] = [
        //     {
        //         domain: 'www.sportmaster.ru',
        //         hostOnly: true,
        //         httpOnly: true,
        //         name: 'SMID',
        //         path: '/',
        //         sameSite: 'lax',
        //         secure: false,
        //         session: false,
        //         storeId: null,
        //         value: smid.value,
        //     },
        // ];
        //
        // return JSON.stringify(cookieObject);
    }

    getBaseCookie(): string {
        const cookieInJson: any[] = JSON.parse(this.cookie);
        const cookieNames = ['SMID', 'SMAUTH', 'SMAID', 'smafauth', 'UDID'];

        const cookieObject = cookieNames
            .map(name => cookieInJson.find(cookie => cookie.name === name))
            .filter(cookie => cookie !== undefined);

        return JSON.stringify(cookieObject);
    }
}
