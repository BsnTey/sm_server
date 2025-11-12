import { CommissionType, TypeCalculate, UserTemplate } from '@prisma/client';

export class TemplateCalculateEntity implements UserTemplate {
    id: string;
    name: string;
    template: string;
    commissionType: CommissionType;
    calculateType: TypeCalculate;
    commissionRate: number;
    roundTo: number;
    userTelegramId: string;
    createdAt: Date;
    updatedAt: Date;

    constructor(template: UserTemplate) {
        Object.assign(this, template);
        return this;
    }

    getTemplate() {
        return {
            id: this.id,
            name: this.name,
            template: this.template,
            commissionType: this.commissionType,
            calculateType: this.calculateType,
            commissionRate: this.commissionRate,
            roundTo: this.roundTo,
        };
    }
}
