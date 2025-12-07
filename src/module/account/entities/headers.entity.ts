import md5 from 'md5';
import { IRequestHeadersCourse, IRequestHeadersUserGate, ISportmasterRequestHeaders } from '../interfaces/headers.interface';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SportmasterHeadersService {
    private prefixHash = 'eb1a3e30291bc971c4da0e86375961a4';
    private userAgentMobile: string = 'android-4.85.0-google(60723)';
    private userAgentMobileWeb: string =
        'Mozilla/5.0 (Linux; Android 14; WP32 Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.98 Mobile Safari/537.36 android-4.85.0-google(60723)';
    private locale: string = 'ru';
    private country: string = 'RU';
    private eutc: string = 'UTC+3';
    private acceptEncoding: string = 'gzip, deflate';
    private acceptLanguage: string = 'ru-RU,en-US;q=0.9';
    private contentType: string = 'application/json; charset=utf-8';
    private accept: string = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8';
    private acceptCourse: string = 'application/json, text/plain, */*';
    private aplautBuild: string = '2';
    private secFetchSite: string = 'same-origin';
    private secFetchMode: string = 'cors';
    private secFetchDest: string = 'empty';

    private xLocation: string =
        'H4sIAAAAAAAAAL2Vz2rbQBDGX8XsKSEmaPXPkm9FUYmoLRlVDrSlCDVRg0C2QFYCJhjiJPTSgi89lRySS28F4ybUdWo/w+wbdWSTpk21diltLtrV7KDvx8y3oyOyHyaNJGpnpHpE4gAXRdmsKFSU5TKJkzapSpVNlWqyKPXKefLjsL0bdkj1xdGPN2uPVAmlsipKgqjr5C7PDlohnsFHuIYpO2HHMIQb9g73b+FriZ1h+Aqu74VhBhN2zE7h8+JLtaAbpjne7X6hJ2jCndo8biR7uZrt2L7h1OvOluU98587tkl6vfLvuLKqcHDPYcb6MIERDJcjiGIxQv2R4ToGyhcpC7osV1Yrl9ZYn51gMW5gzN7AcB3TszBNoyxJu4svVURBv09QRMkplGe6ruU5bhGloum6zoG8yCERc8wGBUyyoimoSOlyKIEDZThN2ytEohVJkdUHLBzlMT7dthp10/a45hL0ys/u5JLiJnf/CEH7MIUhG5TgC5JP58b7u27LPGjT3bEMc8mFoBrlMl/Chw2htNb0jA1pfYXdKMduVn2ZuqKuuhQzGM1XLJNPfTj3keoS3vu/lBQfU3Y6nzXjEnzL0+FqBbBUDLxl1qwd0+XPEI1S8Y/aPMCO4qDDudYvYQyNCZP/xCRRRRYfcrqoHL81LONJs+E3HGvJRdHQrrwpfJF3+BP2F83xb4r1Mv+l7QZZlLSLR/3taS08DGM8drxt08V41DGS9usobYUomKUHYZkEh0EUB6+iOMq6RnzQyXIy0ko6abhPet8Be1cRK1gHAAA=';

    private host: string = this.configService.getOrThrow('HOST_DONOR');
    private hostSite: string = 'www.' + this.configService.getOrThrow('HOST_DONOR_SITE');
    private xRequestedWith: string = this.configService.getOrThrow('X_REQUESTED_WITH');
    private onlineCourses: string = this.configService.getOrThrow('ONLINE_COURSES');

    constructor(private configService: ConfigService) {}

    getHeadersMobile(url: string, acc: any): ISportmasterRequestHeaders {
        const timestamp = String(Math.floor(Date.now() / 1000));
        return {
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
    }

    getAnonymHeadersMobile(deviceId: string): ISportmasterRequestHeaders {
        const timestamp = String(Math.floor(Date.now() / 1000));
        return {
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
    }

    getHeadersRefreshMobile(url: string, acc: any): ISportmasterRequestHeaders {
        const timestamp = String(Math.floor(Date.now() / 1000));
        return {
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
    }

    getHeadersForSearchAccount(url: string, { deviceId, installationId, cityId, xUserId, accessToken }: any): Record<string, string> {
        const timestamp = String(Math.floor(Date.now() / 1000));

        return {
            'User-Agent': this.userAgentMobile,
            Locale: 'ru',
            Country: 'RU',
            'Device-Id': deviceId,
            'X-Device-Id': deviceId,
            'Installation-Id': installationId,
            'X-Request-Id': crypto.randomUUID(),
            'City-Id': cityId,
            'X-User-Id': xUserId,
            Timestamp: timestamp,
            'Aplaut-Id': this.generateHash(url, xUserId, timestamp),
            'Aplaut-Build': '2',
            Accept: 'application/json',
            Authorization: accessToken,
            'Content-Type': 'application/json; charset=UTF-8',
            'Accept-Encoding': 'gzip, deflate, br',
        };
    }

    getHeadersUserGate(userGateToken: string): IRequestHeadersUserGate {
        return {
            'User-Agent': this.userAgentMobileWeb,
            Host: this.hostSite,
            'Upgrade-Insecure-Requests': 1,
            Accept: this.accept,
            'Ug-Token': userGateToken,
            'Accept-Encoding': this.acceptEncoding + ', br',
            'Accept-Language': this.acceptLanguage,
            'X-Requested-With': this.xRequestedWith,
            Referer: this.onlineCourses,
        };
    }

    getHeadersWithAccessToken(accessToken: string, videoId?: string, lessonId?: string, mnemocode?: string): IRequestHeadersCourse {
        let referer;
        if (!mnemocode) {
            referer = this.onlineCourses;
        } else {
            referer = `https://${this.hostSite}courses/courses/mobile/`;
        }

        return {
            'User-Agent': this.userAgentMobileWeb,
            Host: this.hostSite,
            Accept: this.accept,
            Accesstoken: accessToken,
            'X-Requested-With': this.xRequestedWith,
            'Sec-Fetch-Site': this.secFetchSite,
            'Sec-Fetch-Mode': this.secFetchMode,
            'Sec-Fetch-Dest': this.secFetchDest,
            'Accept-Encoding': this.acceptEncoding + ', br',
            'Accept-Language': this.acceptLanguage,
            Referer: referer,
        };
    }

    private generateHash(url: string, xUserId: string, timestamp: string): string {
        const combinedString = this.prefixHash + url + timestamp + xUserId;
        return md5(combinedString);
    }
}
