import md5 from 'md5';
import { ISportmasterRequestHeaders } from '../interfaces/headers.interface';

export class SportmasterHeaders {
    private prefixHash = 'eb1a3e30291bc971c4da0e86375961a4';
    private userAgent: string = 'android-4.44.0-google(44971)';
    private locale: string = 'ru';
    private country: string = 'RU';
    private eutc: string = 'UTC+3';
    private acceptEncoding: string = 'gzip, deflate';
    private contentType: string = 'application/json; charset=utf-8';
    private aplautBuild: string = '2';
    private host: string = 'mp4x-api.sportmaster.ru';
    private url: string;
    private deviceId: string;
    private accountId: string;
    private installationId: string;
    private cityId: string;
    private xUserId: string;
    private accessToken: string;

    constructor(url: string, { deviceId, accountId, installationId, cityId, xUserId, accessToken }: any) {
        this.url = url;
        this.deviceId = deviceId;
        this.accountId = accountId;
        this.installationId = installationId;
        this.cityId = cityId;
        this.xUserId = xUserId;
        this.accessToken = accessToken;
    }

    getHeaders(): ISportmasterRequestHeaders {
        const timestamp = String(Math.floor(Date.now() / 1000));
        return {
            'User-Agent': this.userAgent,
            Locale: this.locale,
            Country: this.country,
            'Device-Id': this.deviceId,
            'Account-Id': this.accountId,
            'Installation-Id': this.installationId,
            'City-Id': this.cityId,
            Eutc: this.eutc,
            'x-user-id': this.xUserId,
            Authorization: this.accessToken,
            Host: this.host,
            'Accept-Encoding': this.acceptEncoding,
            'Content-Type': this.contentType,
            Timestamp: timestamp,
            'Aplaut-Id': this.generateHash(timestamp),
            'Aplaut-Build': this.aplautBuild,
        };
    }

    private generateHash(timestamp: string): string {
        const combinedString = this.prefixHash + this.url + timestamp + this.xUserId;
        return md5(combinedString);
    }
}
