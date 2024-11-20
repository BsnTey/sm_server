import md5 from 'md5';
import { IRequestHeadersCourse, IRequestHeadersUserGate, ISportmasterRequestHeaders } from '../interfaces/headers.interface';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SportmasterHeadersService {
    private prefixHash = 'eb1a3e30291bc971c4da0e86375961a4';
    private userAgentMobile: string = 'android-4.44.0-google(44971)';
    private userAgentMobileWeb: string =
        'Mozilla/5.0 (Linux; Android 7.1.2; ASUS_Z01QD Build/N2G48H; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/68.0.3440.70 Mobile Safari/537.36 android-4.52.0-google(48799)';
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

    private host: string = this.configService.getOrThrow('HOST_DONOR');
    private hostSite: string = 'www.' + this.configService.getOrThrow('HOST_DONOR_SITE');
    private xRequestedWith: string = this.configService.getOrThrow('X_REQUESTED_WITH');
    private onlineCourses: string = this.configService.getOrThrow('ONLINE_COURSES');

    constructor(private configService: ConfigService) {}

    getHeadersMobile(url: string, { deviceId, accountId, installationId, cityId, xUserId, accessToken }: any): ISportmasterRequestHeaders {
        const timestamp = String(Math.floor(Date.now() / 1000));
        return {
            'User-Agent': this.userAgentMobile,
            Locale: this.locale,
            Country: this.country,
            'Device-Id': deviceId,
            'Account-Id': accountId,
            'Installation-Id': installationId,
            'City-Id': cityId,
            Eutc: this.eutc,
            'x-user-id': xUserId,
            Authorization: accessToken,
            Host: this.host,
            'Accept-Encoding': this.acceptEncoding,
            'Content-Type': this.contentType,
            Timestamp: timestamp,
            'Aplaut-Id': this.generateHash(url, xUserId, timestamp),
            'Aplaut-Build': this.aplautBuild,
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
        const referer = videoId
            ? this.onlineCourses
            : 'https://' +
              this.hostSite +
              'courses/mobile-player/?videoId=' +
              videoId +
              '&type=video&lessonId=' +
              lessonId +
              '&mnemocode=' +
              mnemocode;

        return {
            'User-Agent': this.userAgentMobileWeb,
            Host: this.hostSite,
            Accept: this.acceptCourse,
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
