import { UserRole, UserTelegram } from '@prisma/client';

export class UserTelegramEntity implements UserTelegram {
    telegramId: string;
    telegramName: string;
    countBonuses: number;
    role: UserRole;
    isBan: boolean;
    createdAt: Date;
    updatedAt: Date;

    constructor(user: Partial<UserTelegram>) {
        Object.assign(this, user);
        return this;
    }
}
