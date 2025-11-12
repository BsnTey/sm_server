import { Injectable } from '@nestjs/common';
import { UserTemplate } from '@prisma/client';
import { TemplateCalculateEntity } from './template.entity';
import { TemplateRepository } from './template.repository';
import { CreateTemplateRequestDto } from '../user/template/dto/create-template.dto';

@Injectable()
export class TemplateService {
    constructor(private readonly templateRepository: TemplateRepository) {}

    async getUserTemplates(userTelegramId: string): Promise<UserTemplate[]> {
        return this.templateRepository.getUserTemplates(userTelegramId);
    }

    async createTemplate(data: CreateTemplateRequestDto) {
        const t = await this.templateRepository.createTemplate(
            data.userTelegramId,
            data.name,
            data.template,
            data.commissionType,
            data.calculateType,
            data.commissionRate,
            data.roundTo,
        );

        return new TemplateCalculateEntity(t).getTemplate();
    }

    async deleteTemplate(id: string, userTelegramId: string): Promise<void> {
        await this.templateRepository.deleteTemplate(id, userTelegramId);
    }

    async getTemplateById(id: string): Promise<UserTemplate | null> {
        return this.templateRepository.getTemplateById(id);
    }

    async getTemplatesByTelegramId(telegramId: string) {
        const templ = await this.templateRepository.getTemplatesByTelegramId(telegramId);
        return templ.map(t => new TemplateCalculateEntity(t).getTemplate());
    }
}
