import { HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRepository } from './account.repository';
import { AddingAccountRequestDto } from './dto/create-account.dto';
import { AccountEntity } from './entities/account.entity';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { IRefreshAccount } from './interfaces/account.interface';
import { Account } from '@prisma/client';
import { ProxyService } from '../proxy/proxy.service';
import axios from 'axios';
import { ERROR_ACCOUNT_NOT_FOUND, ERROR_LOGOUT_MP } from './constants/error.constant';

@Injectable()
export class AccountService {
    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private accountRep: AccountRepository,
        private proxyService: ProxyService,
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

    // async forceRefresh(accountId: string) {
    //     const accountEntity = await this.getAccountEntity(accountId);
    //     await this.refreshForValidation(accountEntity);
    // }

    private async refreshForValidation(accountEntity: AccountEntity) {
        const url = 'https://mp4x-api.sportmaster.ru/api/v1/auth/refresh';
        const headers = accountEntity.getHeaders(url);

        const payload = {
            refreshToken: accountEntity.refreshToken,
            deviceId: accountEntity.deviceId,
        };
        const response = await axios.post(url, payload, {
            headers,
            httpsAgent: accountEntity.httpsAgent,
        });

        accountEntity.accessToken = response.data.data.token.accessToken;
        accountEntity.refreshToken = response.data.data.token.refreshToken;
        const expires = response.data.data.token.expiresIn;
        const expiresInTimestamp = Date.now() + +expires * 1000;
        const expiresInDate = new Date(expiresInTimestamp);
        accountEntity.expiresIn = expiresInDate;
        await this.updateTokensAccount(accountEntity.accountId, {
            accessToken: accountEntity.accessToken,
            refreshToken: accountEntity.refreshToken,
            expiresIn: expiresInDate,
        });
    }

    private async getAccountEntity(accountId: string): Promise<AccountEntity> {
        let accountEntity = await this.cacheManager.get<AccountEntity>(accountId);
        if (accountEntity) {
            console.log('взял из кеша');
            return accountEntity;
        }
        const account = await this.accountRep.getAccount(accountId);
        if (account) {
            accountEntity = new AccountEntity(account);
            const proxy = this.proxyService.getRandomProxy();
            accountEntity.setProxy(proxy);
            console.log('взял из БД');
            return accountEntity;
        }
        throw new NotFoundException(ERROR_ACCOUNT_NOT_FOUND);
    }

    private async validationToken(accountEntity: AccountEntity) {
        const isUpdate = accountEntity.updateTokensByTime();
        if (isUpdate) {
            await this.refreshForValidation(accountEntity);
        }
    }

    private async getAccount(accountId: string) {
        const accountEntity = await this.getAccountEntity(accountId);
        if (!accountEntity.isAccessMp) {
            throw new HttpException(ERROR_LOGOUT_MP, HttpStatus.FORBIDDEN);
        }
        await this.validationToken(accountEntity);
        return accountEntity;
    }

    async shortInfo(accountId: string) {
        const accountEntity = await this.getAccount(accountId);

        const url = 'https://mp4x-api.sportmaster.ru/api/v2/bonus/shortInfo';
        const headers = accountEntity.getHeaders(url);
        const response = await axios.get(url, {
            headers,
            httpsAgent: accountEntity.httpsAgent,
        });
        const bonusCount: number = +response.data.data.info.totalAmount;
        const qrCode: string = response.data.data.info.clubCard.qrCode;
        await this.updateAccountBonusCount(accountId, bonusCount);
        return { bonusCount, qrCode };
    }
}
