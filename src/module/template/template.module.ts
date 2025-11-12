import { Module } from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateRepository } from './template.repository';

@Module({
    providers: [TemplateService, TemplateRepository],
    exports: [TemplateService],
})
export class TemplateModule {}
