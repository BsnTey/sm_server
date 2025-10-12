import { Injectable } from '@nestjs/common';
import { CalculateRepository } from './calculate.repository';
import { UserTemplate } from '@prisma/client';
import { CommissionType } from '../../scenes/calculate.scene-constant';

@Injectable()
export class CalculateServiceTelegram {
    constructor(private readonly calculateRepository: CalculateRepository) {}

    async getUserTemplates(userTelegramId: string): Promise<UserTemplate[]> {
        return this.calculateRepository.getUserTemplates(userTelegramId);
    }

    async createTemplate(
        userTelegramId: string,
        name: string,
        template: string,
        commissionType: CommissionType,
        commissionRate: number,
        roundTo: number = 10,
    ): Promise<UserTemplate> {
        return this.calculateRepository.createTemplate(userTelegramId, name, template, commissionType, commissionRate, roundTo);
    }

    async deleteTemplate(id: string, userTelegramId: string): Promise<void> {
        await this.calculateRepository.deleteTemplate(id, userTelegramId);
    }

    async getTemplateById(id: string): Promise<UserTemplate | null> {
        return this.calculateRepository.getTemplateById(id);
    }

    calculateCommission(
        commissionType: string,
        commissionRate: number,
        roundTo: number,
        totalBonus: number,
        totalPromo: number,
        totalDiscount: number,
    ): number {
        let baseAmount = 0;

        switch (commissionType) {
            case 'BONUS':
                baseAmount = totalBonus;
                break;
            case 'PROMO':
                baseAmount = totalPromo;
                break;
            case 'TOTAL':
            default:
                baseAmount = totalDiscount;
                break;
        }

        let commission = baseAmount * (commissionRate / 100);

        if (commission % roundTo !== 0) {
            commission = Math.ceil(commission / roundTo) * roundTo;
        }

        return Math.floor(commission);
    }

    applyTemplate(template: string, totalPrice: number, commission: number): string {
        return template
            .replace(/{payment}/g, totalPrice.toString())
            .replace(/{commission}/g, commission.toString())
            .replace(/\/n/g, '\n');
    }
}
