import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Post } from '@nestjs/common';
import { CreateTemplateRequestDto } from './template/dto/create-template.dto';
import { TelegramIdParamsDto } from '../account/dto/telegramId.dto';
import { TemplateService } from '../template/template.service';
import { IdRequestDto } from './template/dto/id-template.dto';

@Controller('user')
export class UserController {
    constructor(private readonly templateService: TemplateService) {}

    @Post('template')
    async createTemplate(@Body() data: CreateTemplateRequestDto): Promise<any> {
        try {
            return this.templateService.createTemplate(data);
        } catch (e: any) {
            throw new HttpException('Ошибка создании шаблона', HttpStatus.BAD_REQUEST);
        }
    }

    @Get('templates/:telegramId')
    async getTemplatesUser(@Param() params: TelegramIdParamsDto): Promise<any> {
        try {
            return this.templateService.getTemplatesByTelegramId(params.telegramId);
        } catch (e: any) {
            throw new HttpException('Ошибка получения шаблона', HttpStatus.BAD_REQUEST);
        }
    }

    @Delete('template/:telegramId')
    async deleteTemplatesUser(@Param() params: TelegramIdParamsDto, @Body() data: IdRequestDto): Promise<any> {
        try {
            return this.templateService.deleteTemplate(data.id, params.telegramId);
        } catch (e: any) {
            throw new HttpException('Ошибка удаления шаблона', HttpStatus.BAD_REQUEST);
        }
    }
}
