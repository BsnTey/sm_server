import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';

@Injectable()
export class CalculateRepository {
    constructor(private readonly prisma: PrismaService) {}

    async getUserTemplates(userTelegramId: string) {
        return this.prisma.userTemplate.findMany({
            where: { userTelegramId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createTemplate(
        userTelegramId: string,
        name: string,
        template: string,
        commissionType: string,
        commissionRate: number,
        roundTo: number,
    ) {
        return this.prisma.userTemplate.create({
            data: {
                name,
                template,
                commissionType,
                commissionRate,
                roundTo,
                userTelegram: {
                    connect: { telegramId: userTelegramId },
                },
            },
        });
    }

    async deleteTemplate(id: string, userTelegramId: string) {
        return this.prisma.userTemplate.deleteMany({
            where: {
                id,
                userTelegramId,
            },
        });
    }

    async getTemplateById(id: string) {
        return this.prisma.userTemplate.findUnique({
            where: { id },
        });
    }
}
