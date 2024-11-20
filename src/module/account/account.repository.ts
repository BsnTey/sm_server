// @ts-ignore

import { Injectable } from '@nestjs/common';
import { Account, Order, Prisma } from '@prisma/client';
import { PrismaService } from '@common/database/prisma.service';
import { AccountEntity } from './entities/account.entity';
import { IAccountCourse, IAccountWithProxy, IEmailFromDb, IRefreshDataAccount, IUpdateAccount } from './interfaces/account.interface';
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
            accessTokenCourse: account.accessTokenCourse,
            refreshTokenCourse: account.refreshTokenCourse,
            statusCourse: account.statusCourse,
            isValidAccessTokenCourse: account.isValidAccessTokenCourse,
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

    async getAccountEmail(accountId: string): Promise<IEmailFromDb | null> {
        return this.prisma.account.findUnique({
            where: { accountId },
            select: {
                email: true,
                passImap: true,
                passEmail: true,
            },
        });
    }

    async getEmail(email: string): Promise<Account | null> {
        return this.prisma.account.findFirst({
            where: { email },
        });
    }

    async updateAccount(
        accountId: string,
        { accessToken, refreshToken, xUserId, deviceId, installationId, expiresInAccess, expiresInRefresh, isAccessMp }: IUpdateAccount,
    ): Promise<Account> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                accessToken,
                refreshToken,
                xUserId,
                deviceId,
                installationId,
                expiresInAccess,
                expiresInRefresh,
                isAccessMp,
            },
        });
    }

    async updateTokensAccount(
        accountId: string,
        { accessToken, refreshToken, expiresInAccess, expiresInRefresh }: IRefreshDataAccount,
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

    async setBanMp(accountId: string): Promise<Account> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                isAccessMp: false,
            },
        });
    }

    async updateUserGateToken(accountId: string, userGateToken: string): Promise<Account> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                userGateToken,
            },
        });
    }

    async updateBonusCount(accountId: string, bonusCount: number): Promise<Account> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                bonusCount,
            },
        });
    }

    async updatePushToken(accountId: string, pushToken: string): Promise<Account> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                pushToken,
            },
        });
    }

    async updateGoogleId(accountId: string, googleId: string): Promise<Account> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                googleId,
            },
        });
    }

    async finishedCourses(accountId: string): Promise<Account> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                statusCourse: 'FINISHED',
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

    async getActiveCourseAccount(): Promise<IAccountCourse[]> {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const foundAccounts = await this.prisma.account.findMany({
            where: {
                statusCourse: 'ACTIVE',
            },
            include: {
                AccountCourse: {
                    include: {
                        course: {
                            include: {
                                lessons: {
                                    include: {
                                        AccountLessonProgress: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        return foundAccounts.map(acc => {
            return {
                ...acc,
                AccountCourse: acc.AccountCourse.map(accountCourse => {
                    return {
                        ...accountCourse,
                        course: {
                            ...accountCourse.course,
                            lessons: accountCourse.course.lessons
                                .map(lesson => {
                                    return {
                                        ...lesson,
                                        AccountLessonProgress: lesson.AccountLessonProgress.filter(
                                            progress => progress.accountId === acc.accountId,
                                        ),
                                    };
                                })
                                .sort((a, b) => a.position - b.position),
                        },
                    };
                }).sort((a, b) => a.course.courseId.localeCompare(b.course.courseId)),
            };
        });
    }
}
