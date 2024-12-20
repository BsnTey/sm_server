import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { TelegramService } from '../telegram/telegram.service';
import { join } from 'path';

@Controller('webapp')
export class WebAppController {
    constructor(private telegramService: TelegramService) {}

    @Get('auth')
    async serveAuthPage(@Res() res: Response) {
        const filePath = join(process.cwd(), 'views', 'web-app.auth.html');
        res.sendFile(filePath);
    }

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
