import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { CommissionType, TypeCalculate } from '@prisma/client';

@Injectable()
export class TemplateRepository {
    constructor(private readonly prisma: PrismaService) {}

    async getUserTemplates(userTelegramId: string) {
        return this.prisma.userTemplate.findMany({
            where: { userTelegramId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createTemplate(
        userTelegram: string,
        name: string,
        template: string,
        commissionType: CommissionType | undefined,
        calculateType: TypeCalculate | undefined,
        commissionRate: number,
        roundTo: number,
    ) {
        return this.prisma.userTemplate.create({
            data: {
                name,
                template,
                commissionType,
                calculateType,
                commissionRate,
                roundTo,
                userTelegram: {
                    connect: { telegramId: userTelegram },
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

    async getTemplatesByTelegramId(telegramId: string) {
        return this.prisma.userTemplate.findMany({
            where: { userTelegramId: telegramId },
        });
    }
}
