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

    async getUserCities(telegramId: string): Promise<any> {
        return this.prisma.userCitySM.findMany({
            where: {
                userTelegramId: telegramId,
            },
            include: {
                city: true,
            },
        });
    }

    async addUserCity(telegramId: string, cityId: string): Promise<any> {
        return this.prisma.userCitySM.upsert({
            where: {
                cityId_userTelegramId: {
                    cityId,
                    userTelegramId: telegramId,
                },
            },
            update: {},
            create: {
                city: {
                    connect: {
                        cityId,
                    },
                },
                userTelegram: {
                    connect: {
                        telegramId,
                    },
                },
            },
        });
    }

    async deleteUserCity(telegramId: string, cityId: string): Promise<void> {
        await this.prisma.userCitySM.delete({
            where: {
                cityId_userTelegramId: {
                    cityId,
                    userTelegramId: telegramId,
                },
            },
        });
    }
}
