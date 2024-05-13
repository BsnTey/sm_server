import { Account } from '@prisma/client';
import { HashString, IHashAplaut } from '../../sport/interfaces/sport.interface';
import md5 from 'md5';
import { SocksProxyAgent } from 'socks-proxy-agent';

export class AccountEntity implements Account {
    private prefixHash = 'eb1a3e30291bc971c4da0e86375961a4';
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
    googleId: string;
    pushToken: string;
    expiresIn: Date;
    bonusCount: number;
    isAccessMp: boolean;
    isAccessCookie: boolean;
    isOnlyAccessOrder: boolean;
    isUpdateBonus: boolean;
    ownerTelegramId: string;
    proxy: string;
    cityId = '1720920299';
    cityName = 'Москва';
    httpsAgent: SocksProxyAgent;

    createdAt: Date;
    updatedAt: Date;

    constructor(user: Partial<Account>) {
        Object.assign(this, user);
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

    private generateHash({ url, timestamp }: IHashAplaut): HashString {
        const combinedString = this.prefixHash + url + timestamp + this.xUserId;
        console.log(combinedString);
        return md5(combinedString);
    }

    getHeaders(url: string) {
        const timestamp = String(Date.now());
        const hash = this.generateHash({ url, timestamp });

        return {
            'User-Agent': 'android-4.44.0-google(44971)',
            Locale: 'ru',
            Country: 'RU',
            'Device-Id': this.deviceId,
            'Account-Id': this.accountId,
            'Installation-Id': this.installationId,
            'City-Id': this.cityId,
            Eutc: 'UTC+3',
            'x-user-id': this.xUserId,
            Authorization: this.accessToken,
            Host: 'mp4x-api.sportmaster.ru',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json; charset=utf-8',
            Timestamp: timestamp,
            'Aplaut-Id': hash,
            'Aplaut-Build': '2',
        };
    }

    setProxy(proxy: string) {
        this.proxy = proxy;
        this.httpsAgent = new SocksProxyAgent(proxy);
    }

    setCity(cityId: string, cityName: string): void {
        this.cityId = cityId;
        this.cityName = cityName;
    }
}
