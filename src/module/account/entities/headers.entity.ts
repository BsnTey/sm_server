import md5 from 'md5';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountWithProxyEntity } from './accountWithProxy.entity';
import { HeaderPackage } from '../../http/interfaces/http.interface';
import { DeviceInfoEntity } from '@core/device/entities/device-info.entity';
import { ProtectedTokensInterface } from '../interfaces/protected-tokens.interface';

@Injectable()
export class SportmasterHeadersService {
    private prefixHash = 'eb1a3e30291bc971c4da0e86375961a4';
    private userAgentWeb =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
    private userAgentMobile = 'android-4.85.0-google(60723)';
    private userAgentMobileWeb =
        'Mozilla/5.0 (Linux; Android 14; WP32 Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.98 Mobile Safari/537.36 android-4.85.0-google(60723)';
    private locale = 'ru';
    private country = 'RU';
    private eutc = 'UTC+3';
    private acceptEncoding = 'gzip, deflate';
    private acceptLanguage = 'ru-RU,en-US;q=0.9';
    private contentType = 'application/json; charset=utf-8';
    private accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8';
    private acceptWeb =
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
    private acceptCourse = 'application/json, text/plain, */*';
    private aplautBuild = '2';
    private secFetchSite = 'same-origin';
    private secFetchMode = 'cors';
    private secFetchDest = 'empty';

    private xLocation =
        'H4sIAAAAAAAAAL2Vz2rbQBDGX8XsKSEmaPXPkm9FUYmoLRlVDrSlCDVRg0C2QFYCJhjiJPTSgi89lRySS28F4ybUdWo/w+wbdWSTpk21diltLtrV7KDvx8y3oyOyHyaNJGpnpHpE4gAXRdmsKFSU5TKJkzapSpVNlWqyKPXKefLjsL0bdkj1xdGPN2uPVAmlsipKgqjr5C7PDlohnsFHuIYpO2HHMIQb9g73b+FriZ1h+Aqu74VhBhN2zE7h8+JLtaAbpjne7X6hJ2jCndo8biR7uZrt2L7h1OvOluU98587tkl6vfLvuLKqcHDPYcb6MIERDJcjiGIxQv2R4ToGyhcpC7osV1Yrl9ZYn51gMW5gzN7AcB3TszBNoyxJu4svVURBv09QRMkplGe6ruU5bhGloum6zoG8yCERc8wGBUyyoimoSOlyKIEDZThN2ytEohVJkdUHLBzlMT7dthp10/a45hL0ys/u5JLiJnf/CEH7MIUhG5TgC5JP58b7u27LPGjT3bEMc8mFoBrlMl/Chw2htNb0jA1pfYXdKMduVn2ZuqKuuhQzGM1XLJNPfTj3keoS3vu/lBQfU3Y6nzXjEnzL0+FqBbBUDLxl1qwd0+XPEI1S8Y/aPMCO4qDDudYvYQyNCZP/xCRRRRYfcrqoHL81LONJs+E3HGvJRdHQrrwpfJF3+BP2F83xb4r1Mv+l7QZZlLSLR/3taS08DGM8drxt08V41DGS9usobYUomKUHYZkEh0EUB6+iOMq6RnzQyXIy0ko6abhPet8Be1cRK1gHAAA=';

    private host = this.configService.getOrThrow('HOST_DONOR');
    private hostSite = 'www.' + this.configService.getOrThrow('HOST_DONOR_SITE');
    private xRequestedWith = this.configService.getOrThrow('X_REQUESTED_WITH');
    private onlineCourses = this.configService.getOrThrow('ONLINE_COURSES');

    constructor(private configService: ConfigService) {}

    getHeadersMobile(url: string, acc: AccountWithProxyEntity): HeaderPackage {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const headers = {
            'User-Agent': this.userAgentMobile,
            Host: this.host,
            Locale: this.locale,
            Country: this.country,
            'Device-Id': acc.deviceId,
            'X-Device-Id': acc.deviceId,
            'Installation-Id': acc.installationId,
            'City-Id': acc.cityId,
            Eutc: this.eutc,
            'x-user-id': acc.xUserId,
            'X-Location': acc?.citySM?.xLocation ?? this.xLocation,
            Authorization: acc.accessToken,
            'Accept-Encoding': this.acceptEncoding,
            'Content-Type': this.contentType,
            Timestamp: timestamp,
            'Aplaut-Id': this.generateHash(url, acc.xUserId, timestamp),
            'Aplaut-Build': this.aplautBuild,
        };

        return {
            headers,
            tlsClientIdentifier: this.getMobileTlsProfile(acc.deviceInfo.osVersion),
        };
    }

    getAnonymHeadersMobile(deviceId: string, device: DeviceInfoEntity): HeaderPackage {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const headers = {
            'User-Agent': this.userAgentMobile,
            Host: this.host,
            Locale: this.locale,
            Country: this.country,
            'Device-Id': deviceId,
            'X-Device-Id': deviceId,
            'Accept-Encoding': this.acceptEncoding,
            'Content-Type': this.contentType,
            Timestamp: timestamp,
            'Aplaut-Build': this.aplautBuild,
        };

        return {
            headers,
            tlsClientIdentifier: this.getMobileTlsProfile(device.osVersion),
        };
    }

    getHeadersRefreshMobile(url: string, acc: AccountWithProxyEntity): HeaderPackage {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const headers = {
            'User-Agent': this.userAgentMobile,
            Host: this.host,
            Locale: this.locale,
            Country: this.country,
            'Device-Id': acc.deviceId,
            'X-Device-Id': acc.deviceId,
            'Installation-Id': acc.installationId,
            'City-Id': acc.cityId,
            Eutc: this.eutc,
            'x-user-id': acc.xUserId,
            'X-Location': acc.citySM.xLocation,
            'Accept-Encoding': this.acceptEncoding,
            'Content-Type': this.contentType,
            Timestamp: timestamp,
            'Aplaut-Id': this.generateHash(url, acc.xUserId, timestamp),
            'Aplaut-Build': this.aplautBuild,
        };

        return {
            headers,
            tlsClientIdentifier: this.getMobileTlsProfile(acc.deviceInfo.osVersion),
        };
    }

    getHeadersSite(acc: AccountWithProxyEntity, qratorJsid: string): HeaderPackage {
        const cookie = acc.getBasePrepareRequestCookie({
            qrator_jsid: qratorJsid,
        });

        const headers = {
            'User-Agent': this.userAgentWeb,
            Accept: this.acceptWeb,
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            cookie,
        };

        return {
            headers,
            tlsClientIdentifier: this.getWebTlsProfile(acc),
        };
    }

    getHeadersForCourse(acc: AccountWithProxyEntity, tokens: ProtectedTokensInterface): HeaderPackage {
        const cookie = acc.getBasePrepareRequestCookie({
            qrator_jsid: tokens.qratorJsid,
        });

        const headers = {
            'User-Agent': this.userAgentWeb,
            Accept: this.acceptCourse,
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            Accesstoken: tokens.accessToken,
            cookie,
        };

        return {
            headers,
            tlsClientIdentifier: this.getWebTlsProfile(acc),
        };
    }

    getHeadersWithAccessToken(acc: AccountWithProxyEntity): HeaderPackage {
        if (!acc.accessTokenCourse) {
            throw new Error(`Отсутствует токен курсов у ${acc.accountId}`);
        }

        const headers = {
            'User-Agent': this.userAgentMobileWeb,
            Host: this.hostSite,
            Accept: this.acceptCourse,
            Accesstoken: acc.accessTokenCourse,
            'X-Requested-With': this.xRequestedWith,
            'Sec-Fetch-Site': this.secFetchSite,
            'Sec-Fetch-Mode': this.secFetchMode,
            'Sec-Fetch-Dest': this.secFetchDest,
            'Accept-Language': this.acceptLanguage,
        };

        return {
            headers,
            tlsClientIdentifier: this.getMobileTlsProfile(acc.deviceInfo.osVersion),
        };
    }

    private generateHash(url: string, xUserId: string, timestamp: string): string {
        const combinedString = this.prefixHash + url + timestamp + xUserId;
        return md5(combinedString);
    }

    private getMobileTlsProfile(osVersion: string): string {
        const version = parseInt(osVersion, 10) || 11;

        if (version >= 13) return 'okhttp4_android_13';
        if (version === 12) return 'okhttp4_android_12';

        return 'okhttp4_android_11';
    }

    private getWebTlsProfile(account: AccountWithProxyEntity): string {
        const version = account.deviceInfo.browserVersion?.split('.')[0] || '124';
        return `chrome_${version}`;
    }
}
