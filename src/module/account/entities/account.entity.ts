import { Account } from '@prisma/client';

export class AccountEntity implements Account {
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

    createdAt: Date;
    updatedAt: Date;

    constructor(user: Partial<Account>) {
        Object.assign(this, user);
        return this;
    }
}
