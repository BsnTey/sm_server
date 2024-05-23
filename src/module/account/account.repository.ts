import { Injectable } from '@nestjs/common';
import { Account, Order, Prisma } from '@prisma/client';
import { PrismaService } from '@common/database/prisma.service';
import { AccountEntity } from './entities/account.entity';
import { IAccountWithProxy, IRefreshAccount } from './interfaces/account.interface';
import { CitySMEntity } from './entities/citySM.entity';

@Injectable()
export class AccountRepository {
    constructor(private prisma: PrismaService) {}

    async addingAccount(account: AccountEntity): Promise<Account> {
        const accountData: Prisma.AccountCreateInput = {
            accountId: account.accountId,
            email: account.email,
            passImap: account.passImap,
            passEmail: account.passEmail,
            cookie: account.cookie,
            accessToken: account.accessToken,
            refreshToken: account.refreshToken,
            xUserId: account.xUserId,
            deviceId: account.deviceId,
            installationId: account.installationId,
            googleId: account.googleId,
            pushToken: account.pushToken,
            expiresInAccess: account.expiresInAccess,
            expiresInRefresh: account.expiresInRefresh,
            isAccessMp: account.isAccessMp,
            isAccessCookie: account.isAccessCookie,
            isOnlyAccessOrder: account.isOnlyAccessOrder,
            bonusCount: account.bonusCount,
            isUpdateBonus: account.isUpdateBonus,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
            citySM: {
                connect: {
                    cityId: account.cityId,
                },
            },
            ownerTelegram: {
                connect: {
                    telegramId: account.ownerTelegramId,
                },
            },
            proxy: account.proxyUuid
                ? {
                      connect: {
                          uuid: account.proxyUuid,
                      },
                  }
                : undefined,
        };

        return this.prisma.account.create({
            data: accountData,
        });
    }

    async getAccount(accountId: string): Promise<Account | null> {
        return this.prisma.account.findUnique({
            where: { accountId },
        });
    }

    async getOrder(orderNumber: string): Promise<Order | null> {
        return this.prisma.order.findFirst({
            where: { orderNumber },
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

    async addOrderNumber(accountId: string, orderNumber: string): Promise<Order> {
        return this.prisma.order.create({
            data: {
                orderNumber,
                accountId,
            },
        });
    }
}
