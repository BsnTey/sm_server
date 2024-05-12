import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRepository } from './account.repository';
import { AddingAccountRequestDto } from './dto/create-account.dto';
import { AccountEntity } from './entities/account.entity';
import { SportApi } from '../sport/sport.api';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { IRefreshAccount } from './interfaces/account.interface';
import { Account } from '@prisma/client';
import { ProxyService } from '../proxy/proxy.service';

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

    async findAccount(accountId: string): Promise<AccountEntity | null> {
        const account = await this.accountRep.getAccount(accountId);
        if (account) {
            return new AccountEntity(account);
        }
        return null;
    }

    async getAccountCookie(accountId: string) {
        const account = await this.accountRep.getAccountCookie(accountId);
        return account;
    }

    async findAccountEmail(accountId: string) {
        const account = await this.accountRep.getAccountEmail(accountId);
        return account;
    }

    async updateAccountBonusCount(accountId: string, bonusCount: number) {
        const account = await this.accountRep.updateBonusCount(accountId, bonusCount);
        return account;
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
    async refreshByApi(sportApi: SportApi) {
        const tokens = await sportApi.refresh();
        await this.updateTokensAccount(sportApi.accountId, tokens);
    }

    async refreshByAccountId(accountId: string) {
        const account = await this.findAccount(accountId);

        if (account) {
            const sportApi = new SportApi(account);
            await this.refreshByApi(sportApi);
            return sportApi;
        }
        throw new NotFoundException();
    }

    async refreshByDate(sportApi: SportApi) {
        const isUpdate = this.updateTokensByTime(sportApi.expiresIn);
        if (isUpdate) {
            await this.refreshByApi(sportApi);
        }
    }

    private updateTokensByTime(expiresIn: Date | null) {
        const nowDate = new Date();
        const oneHourNext = new Date(nowDate.getTime() + 60 * 60 * 1000);
        if (expiresIn && oneHourNext < expiresIn) {
            console.log('Не обновлял по времени');
            return false;
        }
        console.log('Иду обновлять по истечению времени');
        return true;
    }

    private async getApi(accountId: string) {
        let sportApi = await this.cacheManager.get<SportApi>(accountId);

        if (sportApi) {
            await this.refreshByDate(sportApi);
            return sportApi;
        }
        sportApi = await this.refreshByAccountId(accountId);
        await this.cacheManager.set(accountId, sportApi);
        return sportApi;
    }

    async shortInfo(accountId: string) {
        const sportApi = await this.getApi(accountId);
        const result = await sportApi.shortInfo();
        await this.updateAccountBonusCount(accountId, result.bonusCount);
        return result;
        //Обернуть в ошибку связанную с блокировкой прокси
    }
}
