import { Injectable } from '@nestjs/common';
import { Account, CourseStatus, Order, Prisma } from '@prisma/client';
import { PrismaService } from '@common/database/prisma.service';
import { AccountEntity } from './entities/account.entity';
import {
    IAccountWithProxy,
    IAccountWithProxyFromDB,
    ICourseTokens,
    IEmailFromDb,
    IRefreshDataAccount,
    IUpdateAccount,
} from './interfaces/account.interface';
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
            userGateToken: account.userGateToken,
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

    async getAccountWithProxy(accountId: string): Promise<IAccountWithProxyFromDB | null> {
        return this.prisma.account.findUnique({
            where: { accountId },
            include: {
                proxy: true,
                citySM: true,
            },
        });
    }

    async setProxyAccount(accountId: string, proxyUuid: string): Promise<IAccountWithProxy> {
        //@ts-ignore
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

    async getAccountCookie(accountId: string) {
        return this.prisma.account.findUnique({
            where: { accountId },
            select: {
                cookie: true,
            },
        });
    }

    async getProxyUuid(accountId: string): Promise<string | null> {
        const result = await this.prisma.account.findUnique({
            where: { accountId },
            select: {
                proxyUuid: true,
            },
        });

        return result?.proxyUuid ?? null;
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
        {
            accessToken,
            refreshToken,
            xUserId,
            deviceId,
            installationId,
            expiresInAccess,
            expiresInRefresh,
            isAccessMp,
            userGateToken,
            accessTokenCourse,
            refreshTokenCourse,
            isValidAccessTokenCourse,
        }: IUpdateAccount,
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
                userGateToken,
                accessTokenCourse,
                refreshTokenCourse,
                isValidAccessTokenCourse,
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

    async updateCourseTokensAccount(
        accountId: string,
        { userGateToken, accessTokenCourse, refreshTokenCourse, isValidAccessTokenCourse }: ICourseTokens,
    ): Promise<Account> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                userGateToken,
                accessTokenCourse,
                refreshTokenCourse,
                isValidAccessTokenCourse,
            },
        });
    }

    async updateStatusAccountCourse(accountId: string, statusCourse: CourseStatus): Promise<Account> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                statusCourse,
            },
        });
    }

    async updateStatusAccountCourseBulk(accountIds: string[], statusCourse: CourseStatus) {
        const res = await this.prisma.account.updateMany({
            where: { accountId: { in: accountIds } },
            data: { statusCourse },
        });
        return res.count;
    }

    async getAccountsCourseByStatus(statusCourse: CourseStatus): Promise<Account[]> {
        return this.prisma.account.findMany({
            where: {
                statusCourse,
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

    async updateCookie(accountId: string, cookie: string): Promise<Account> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                cookie,
            },
        });
    }

    async promblemCourses(accountId: string): Promise<Account> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                statusCourse: 'NONE',
            },
        });
    }

    // async finishedCourses(accountId: string): Promise<Account> {
    //     return this.prisma.account.update({
    //         where: {
    //             accountId,
    //         },
    //         data: {
    //             statusCourse: 'FINISHED',
    //         },
    //     });
    // }

    async setCityToAccount(accountId: string, cityId: string): Promise<Account> {
        return this.prisma.account.update({
            where: { accountId },
            data: { cityId },
        });
    }

    async addingCitySM(city: CitySMEntity) {
        return this.prisma.citySM.create({
            data: {
                cityId: city.cityId,
                name: city.name,
                fullName: city.fullName,
                xLocation: city.xLocation,
            },
        });
    }

    async updateCityXLocation(cityId: string, xLocation: string) {
        await this.prisma.citySM.update({
            where: { cityId },
            data: { xLocation },
        });
    }

    async findCitySM(cityId: string) {
        return this.prisma.citySM.findUnique({
            where: { cityId },
        });
    }

    async getActiveCourseAccount() {
        const accounts = await this.prisma.account.findMany({
            where: {
                statusCourse: 'ACTIVE',
            },
            select: {
                accountId: true,
            },
        });

        return accounts.map(account => account.accountId);
    }

    async addAccountCourses(accountId: string): Promise<void> {
        const courses = await this.prisma.originalCourse.findMany();
        const data = courses.map(course => ({
            accountId,
            courseId: course.courseId,
            status: CourseStatus.BLOCKED,
        }));
        await this.prisma.accountCourse.createMany({
            data,
        });
    }

    async getCredentials(accountId: string) {
        return this.prisma.account.findUnique({
            where: { accountId },
            select: {
                accountId: true,
                email: true,
                passEmail: true,
                passImap: true,
                cookie: true,
                accessToken: true,
                refreshToken: true,
                xUserId: true,
                deviceId: true,
                installationId: true,
                expiresInAccess: true,
                expiresInRefresh: true,
            },
        });
    }

    async updateCredentials(
        accountId: string,
        data: Partial<{
            email: string;
            passEmail: string;
            passImap: string;
            cookie: string;
            accessToken: string;
            refreshToken: string;
            xUserId: string;
            deviceId: string;
            installationId: string;
            expiresInAccess: Date;
            expiresInRefresh: Date;
        }>,
    ) {
        const patch: Prisma.AccountUpdateInput = {};
        for (const [k, v] of Object.entries(data)) {
            if (typeof v !== 'undefined' && v !== null) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                patch[k] = v;
            }
        }
        return this.prisma.account.update({
            where: { accountId },
            data: patch,
            select: {
                accountId: true,
                email: true,
                passEmail: true,
                passImap: true,
                cookie: true,
                accessToken: true,
                refreshToken: true,
                xUserId: true,
                deviceId: true,
                installationId: true,
                expiresInAccess: true,
                expiresInRefresh: true,
            },
        });
    }

    async getAccountsCredentials(accountIds: string[]) {
        return this.prisma.account.findMany({
            where: { accountId: { in: accountIds } },
            select: {
                accountId: true,
                expiresInRefresh: true,
            },
        });
    }

    async updateOwner(accountId: string, ownerTelegramId: string): Promise<void> {
        await this.prisma.account.update({
            where: { accountId },
            data: { ownerTelegramId },
        });
    }

    async getBonusCountByAccountIds(accountIds: string[]): Promise<Record<string, number>> {
        if (!accountIds?.length) return {};

        const rows = await this.prisma.account.findMany({
            where: { accountId: { in: accountIds } },
            select: { accountId: true, bonusCount: true },
        });

        const map: Record<string, number> = {};
        for (const r of rows) {
            map[r.accountId] = r.bonusCount ?? 0;
        }
        return map;
    }
}
