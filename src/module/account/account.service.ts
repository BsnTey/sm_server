import { HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRepository } from './account.repository';
import { AddingAccountRequestDto } from './dto/create-account.dto';
import { AccountEntity } from './entities/account.entity';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { IAccountWithProxy, IRefreshAccount } from './interfaces/account.interface';
import { Account } from '@prisma/client';
import { ProxyService } from '../proxy/proxy.service';
import { ERROR_ACCOUNT_NOT_FOUND, ERROR_LOGOUT_MP } from './constants/error.constant';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../http/http.service';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { SportmasterHeaders } from './entities/headers.entity';
import { AccountWithProxyEntity } from './entities/accountWithProxy.entity';

@Injectable()
export class AccountService {
    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private configService: ConfigService,
        private accountRep: AccountRepository,
        private proxyService: ProxyService,
        private httpService: HttpService,
    ) {}

    async addingAccount(accountDto: AddingAccountRequestDto): Promise<AccountEntity> {
        const {
            accountId,
            email,
            passImap,
            passEmail,
            cookie,
            accessToken,
            refreshToken,
            xUserId,
            deviceId,
            installationId,
            expiresIn,
            bonusCount,
            isOnlyAccessOrder,
        } = accountDto;
        const expiresInTimestamp = Date.now() + +expiresIn * 1000;
        const expiresInDate = new Date(expiresInTimestamp);

        const account = new AccountEntity({
            accountId,
            email,
            passImap,
            passEmail,
            cookie: JSON.stringify(cookie),
            accessToken,
            refreshToken,
            xUserId,
            deviceId,
            installationId,
            expiresIn: expiresInDate,
            bonusCount: +bonusCount,
            isOnlyAccessOrder: Boolean(isOnlyAccessOrder),
        });
        await this.accountRep.addingAccount(account);
        return account;
    }

    async getAccountCookie(accountId: string) {
        return await this.accountRep.getAccountCookie(accountId);
    }

    // async findAccountEmail(accountId: string) {
    //     return await this.accountRep.getAccountEmail(accountId);
    // }

    async updateAccountBonusCount(accountId: string, bonusCount: number) {
        return await this.accountRep.updateBonusCount(accountId, bonusCount);
    }

    async updateTokensAccount(accountId: string, dataAccount: IRefreshAccount): Promise<Account> {
        return await this.accountRep.updateTokensAccount(accountId, dataAccount);
    }

    //
    // async setBanMp(accountId: string) {
    //     const account = await this.accountRep.setBanMp(accountId);
    //     return account;
    // }
    //

    async openForceRefresh(accountId: string) {
        const accountWithProxyEntity = await this.getAccount(accountId);
        await this.refreshForValidation(accountWithProxyEntity);
    }

    private async getHttpOptions(url: string, accountWithProxy: AccountWithProxyEntity): Promise<any> {
        const headers = new SportmasterHeaders(url, accountWithProxy).getHeaders();
        const httpsAgent = new SocksProxyAgent(accountWithProxy.proxy!.proxy);

        return { headers, httpsAgent };
    }

    private async refreshPrivate(accountWithProxy: AccountWithProxyEntity) {
        const tokens = await this.refreshForValidation(accountWithProxy);
        accountWithProxy.accessToken = tokens.accessToken;
        accountWithProxy.refreshToken = tokens.refreshToken;
        accountWithProxy.expiresIn = tokens.expiresIn;
        await this.updateTokensAccount(accountWithProxy.accountId, tokens);
        return tokens;
    }

    private async refreshForValidation(accountWithProxyEntity: AccountWithProxyEntity): Promise<IRefreshAccount> {
        const url = 'https://mp4x-api.sportmaster.ru/api/v1/auth/refresh';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            refreshToken: accountWithProxyEntity.refreshToken,
            deviceId: accountWithProxyEntity.deviceId,
        };

        const response = await this.httpService.post(url, payload, httpOptions);

        const accessToken = response.data.data.token.accessToken;
        const refreshToken = response.data.data.token.refreshToken;
        const expires = response.data.data.token.expiresIn;
        const expiresInTimestamp = Date.now() + +expires * 1000;
        const expiresInDate = new Date(expiresInTimestamp);
        return {
            accessToken,
            refreshToken,
            expiresIn: expiresInDate,
        };
    }

    private async validationToken(accountWithProxy: AccountWithProxyEntity) {
        const isUpdate = accountWithProxy.updateTokensByTime();
        if (isUpdate) {
            await this.refreshPrivate(accountWithProxy);
        }
    }

    private async getAndValidateOrSetProxyAccount(accountWithProxy: IAccountWithProxy): Promise<AccountWithProxyEntity> {
        const currentTime = new Date();
        const durationTimeProxyBlock = this.configService.getOrThrow('TIME_DURATION_PROXY_BLOCK_IN_MIN');
        const timeBlockedAgo = new Date();
        timeBlockedAgo.setMinutes(currentTime.getMinutes() - +durationTimeProxyBlock);

        let accountWithProxyEntity: AccountWithProxyEntity;
        if (
            !accountWithProxy.proxy ||
            accountWithProxy.proxy.expiresAt < currentTime ||
            (accountWithProxy.proxy.blockedAt && accountWithProxy.proxy.blockedAt > timeBlockedAgo)
        ) {
            const proxy = await this.proxyService.getRandomProxy();
            const newAccountWithProxy = await this.accountRep.setProxyAccount(accountWithProxy.accountId, proxy.uuid);
            accountWithProxyEntity = new AccountWithProxyEntity(newAccountWithProxy);
        } else {
            accountWithProxyEntity = new AccountWithProxyEntity(accountWithProxy);
        }
        return accountWithProxyEntity;
    }

    private async getAccount(accountId: string): Promise<AccountWithProxyEntity> {
        const accountWithProxy = await this.accountRep.getAccountWithProxy(accountId);

        if (!accountWithProxy) throw new NotFoundException(ERROR_ACCOUNT_NOT_FOUND);
        if (!accountWithProxy.isAccessMp) throw new HttpException(ERROR_LOGOUT_MP, HttpStatus.FORBIDDEN);
        const accountWithProxyEntity = await this.getAndValidateOrSetProxyAccount(accountWithProxy);
        await this.validationToken(accountWithProxyEntity);

        return accountWithProxyEntity;
    }

    async shortInfo(accountId: string) {
        const { bonusCount, qrCode } = await this.shortInfoPrivate(accountId);
        await this.updateAccountBonusCount(accountId, bonusCount);
        return { bonusCount, qrCode };
    }

    private async shortInfoPrivate(accountId: string) {
        const accountWithProxyEntity = await this.getAccount(accountId);
        const url = 'https://mp4x-api.sportmaster.ru/api/v2/bonus/shortInfo';
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);
        const response = await this.httpService.get(url, httpOptions);

        const bonusCount: number = +response.data.data.info.totalAmount;
        const qrCode: string = response.data.data.info.clubCard.qrCode;
        return { bonusCount, qrCode };
    }

    async sendSms(accountId: string, phoneNumber: string): Promise<string> {
        const accountWithProxyEntity = await this.getAccount(accountId);
        await this.analyticsTags(accountWithProxyEntity);
        await new Promise<void>(resolve => {
            setTimeout(() => {
                resolve();
            }, 1000);
        });
        return await this.sendSmsPrivate(accountWithProxyEntity, phoneNumber);
    }

    async openForceSendSms(accountId: string, phoneNumber: string): Promise<string> {
        const accountWithProxyEntity = await this.getAccount(accountId);
        return await this.sendSmsPrivate(accountWithProxyEntity, phoneNumber);
    }

    private async sendSmsPrivate(accountWithProxyEntity: AccountWithProxyEntity, phoneNumber: string): Promise<string> {
        const url = `https://mp4x-api.sportmaster.ru/api/v1/verify/sendSms`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            phone: {
                countryCode: 7,
                nationalNumber: phoneNumber,
                isoCode: 'RU',
            },
            operation: 'change_phone',
            communicationChannel: 'SMS',
        };
        const response = await this.httpService.post(url, payload, httpOptions);

        return response.data.data.requestId;
    }

    async phoneChange(accountId: string, requestId: string, code: string) {
        const accountWithProxyEntity = await this.getAccount(accountId);
        const token = await this.verifyCheck(accountWithProxyEntity, requestId, code);
        await this.changePhone(accountWithProxyEntity, token);
    }

    private async verifyCheck(accountWithProxyEntity: AccountWithProxyEntity, requestId: string, code: string): Promise<string> {
        const url = `https://mp4x-api.sportmaster.ru/api/v1/verify/check`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            requestId,
            code,
        };

        const response = await this.httpService.post(url, payload, httpOptions);
        return response.data.data.token;
    }

    private async changePhone(accountWithProxyEntity: AccountWithProxyEntity, token: string): Promise<boolean> {
        const url = `https://mp4x-api.sportmaster.ru/api/v1/profile/changePhone`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {
            token,
        };
        await this.httpService.post(url, payload, httpOptions);
        return true;
    }

    async openForceAnalyticsTags(accountId: string) {
        const accountWithProxyEntity = await this.getAccount(accountId);
        await this.analyticsTags(accountWithProxyEntity);
    }

    async analyticsTags(accountWithProxyEntity: AccountWithProxyEntity): Promise<boolean> {
        const url = `https://mp4x-api.sportmaster.ru/api/v2/analytics/tags`;
        const httpOptions = await this.getHttpOptions(url, accountWithProxyEntity);

        const payload = {};
        await this.httpService.post(url, payload, httpOptions);

        return true;
    }
}
