import { Injectable } from '@nestjs/common';
import { Account } from '@prisma/client';
import { PrismaService } from '@common/database/prisma.service';
import { AccountEntity } from './entities/account.entity';
import { IAccountWithProxy, IRefreshAccount } from './interfaces/account.interface';
import { CitySMEntity } from './entities/citySM.entity';

@Injectable()
export class AccountRepository {
    constructor(private prisma: PrismaService) {}

    async addingAccount(account: AccountEntity): Promise<Account> {
        return this.prisma.account.create({
            data: {
                ...account,
            },
        });
    }

    async getAccount(accountId: string): Promise<Account | null> {
        return this.prisma.account.findUnique({
            where: { accountId },
        });
    }

    async getAccountWithProxy(accountId: string): Promise<IAccountWithProxy | null> {
        return this.prisma.account.findUnique({
            where: { accountId },
            include: {
                proxy: true,
                citySM: true,
            },
        });
    }

    async setProxyAccount(accountId: string, proxyUuid: string): Promise<IAccountWithProxy> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                proxy: {
                    connect: {
                        uuid: proxyUuid,
                    },
                },
            },
            include: {
                proxy: true,
                citySM: true,
            },
        });
    }

    async getAccountCookie(accountId: string): Promise<any> {
        return this.prisma.account.findUnique({
            where: { accountId },
            select: {
                cookie: true,
                isOnlyAccessOrder: true,
            },
        });
    }

    async getAccountEmail(accountId: string): Promise<any> {
        return this.prisma.account.findUnique({
            where: { accountId },
            select: {
                email: true,
                passImap: true,
                passEmail: true,
            },
        });
    }

    async updateTokensAccount(
        accountId: string,
        { accessToken, refreshToken, expiresInAccess, expiresInRefresh }: IRefreshAccount,
    ): Promise<Account> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                accessToken,
                refreshToken,
                expiresInAccess,
                expiresInRefresh,
            },
        });
    }

    async setBanMp(accountId: string): Promise<any> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                isAccessMp: false,
            },
        });
    }

    async updateBonusCount(accountId: string, bonusCount: number): Promise<any> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                bonusCount,
            },
        });
    }

    async setCityToAccount(accountId: string, cityId: string): Promise<Account> {
        return this.prisma.account.update({
            where: { accountId },
            data: { cityId },
        });
    }

    async addingCitySM(city: CitySMEntity): Promise<CitySMEntity> {
        return this.prisma.citySM.create({
            data: {
                cityId: city.cityId,
                name: city.name,
                fullName: city.fullName,
            },
        });
    }
}
