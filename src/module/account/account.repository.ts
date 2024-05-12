import { Injectable } from '@nestjs/common';
import { Account } from '@prisma/client';
import { PrismaService } from '@common/database/prisma.service';
import { AccountEntity } from './entities/account.entity';
import { IRefreshAccount } from './interfaces/account.interface';

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

    async updateTokensAccount(accountId: string, { accessToken, refreshToken, expiresIn }: IRefreshAccount): Promise<Account> {
        return this.prisma.account.update({
            where: {
                accountId,
            },
            data: {
                accessToken,
                refreshToken,
                expiresIn,
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
}
