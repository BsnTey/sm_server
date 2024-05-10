import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { UserTelegram } from '@prisma/client';
import { UserTelegramEntity } from './entities/user-telegram.entity';

@Injectable()
export class UserRepository {
    constructor(private readonly prisma: PrismaService) {}

    async createUserByTelegram({ telegramId, telegramName }: UserTelegramEntity): Promise<UserTelegram> {
        return this.prisma.userTelegram.create({
            data: {
                telegramId,
                telegramName,
            },
        });
    }

    async updateUserByTelegram({ telegramId, telegramName }: UserTelegramEntity): Promise<UserTelegram> {
        return this.prisma.userTelegram.update({
            where: {
                telegramId,
            },
            data: {
                telegramName,
            },
        });
    }

    async getUserByTelegramId(telegramId: string): Promise<UserTelegram | null> {
        return this.prisma.userTelegram.findUnique({
            where: {
                telegramId,
            },
        });
    }
}
