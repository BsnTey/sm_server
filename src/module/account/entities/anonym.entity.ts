export class AnonymEntity {
    accessToken: string;
    refreshToken: string;
    xUserId: string;
    deviceId: string;
    installationId: string;
    userGateToken: string | null;
    proxyUuid: string | null;
    cityId = '1720920299';
    cityName? = 'Москва';

    createdAt: Date;
    updatedAt: Date;

    constructor() {
        return this;
    }
}
