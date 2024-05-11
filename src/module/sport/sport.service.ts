import { Injectable } from '@nestjs/common';
import md5 from 'md5';
import { HashString, IHashAplaut } from './interfaces/sport.interface';

@Injectable()
export class SportService {
    private generateHash({ url, timestamp, xUserId }: IHashAplaut): HashString {
        const combinedString = 'eb1a3e30291bc971c4da0e86375961a4' + url + timestamp + xUserId;
        console.log(combinedString);
        return md5(combinedString);
    }

    // private getHeaders(url, xUserId) {
    //     const timestamp = String(Date.now());
    //     const hash = this.generateHash({ url, timestamp, xUserId });
    //
    //     return {
    //         'User-Agent': 'android-4.44.0-google(44971)',
    //         Locale: 'ru',
    //         Country: 'RU',
    //         'Device-Id': this.deviceId,
    //         'Installation-Id': this.installationId,
    //         'City-Id': this.cityId,
    //         Eutc: 'UTC+3',
    //         'x-user-id': this.xUserId,
    //         Authorization: this.accessToken,
    //         Host: 'mp4x-api.sportmaster.ru',
    //         'Accept-Encoding': 'gzip, deflate',
    //         'Content-Type': 'application/json; charset=utf-8',
    //         Timestamp: timestamp,
    //         'Aplaut-Id': hash,
    //         'Aplaut-Build': '2',
    //     };
    // }
}
