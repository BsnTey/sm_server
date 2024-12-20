import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { TelegramService } from '../telegram/telegram.service';

@Controller('webapp')
export class WebAppController {
    constructor(private telegramService: TelegramService) {}

    @Post('auth')
    async handleAuth(@Body() body: any, @Req() request: Request) {
        const telegramId = body.telegramId;
        const ipAddress = request.ip;

        if (!telegramId || !ipAddress) {
            return { success: false, message: 'Не удалось получить данные.' };
        }

        await this.saveUserIpAndNotify(telegramId, ipAddress);

        return { success: true, message: 'Авторизация успешна.' };
    }

    async saveUserIpAndNotify(telegramId: string, ipAddress: string) {
        // this.userIpMap[telegramId] = ipAddress;
        await this.telegramService.sendMessage(Number(telegramId), ipAddress);
    }
}
