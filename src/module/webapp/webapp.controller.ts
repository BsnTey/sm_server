import { BadRequestException, Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { TelegramService } from '../telegram/telegram.service';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { MirrorService } from '../mirror/mirror.service';

@Controller('webapp')
export class WebAppController {
    private DOMAIN = this.configService.getOrThrow('DOMAIN', 'http://localhost:3001');

    constructor(
        private telegramService: TelegramService,
        private configService: ConfigService,
        private mirrorService: MirrorService,
    ) {}

    @Get('auth')
    async serveAuthPage(@Res() res: Response) {
        const filePath = join(process.cwd(), 'views', 'web-app.auth.html');
        res.sendFile(filePath);
    }

    @Post('auth')
    async handleAuth(@Body() body: any, @Req() request: Request) {
        const ipAddress = Array.isArray(request.headers['x-forwarded-for'])
            ? request.headers['x-forwarded-for'][0]
            : request.headers['x-forwarded-for'] || request.ip;

        const { telegramId, accountId, id } = body;
        if (!telegramId || !ipAddress || !accountId || !id) {
            throw new BadRequestException('Не удалось получить данные.');
        }

        await this.mirrorService.updateAccountMirror(id, { accountId, userIp: ipAddress });
        const mirrorToken = await this.mirrorService.generateMirrorToken(id);
        const mirrorUrl = `${this.DOMAIN}/api/mirror/auth?token=${mirrorToken.mirrorToken}`;
        await this.telegramService.sendMessage(Number(telegramId), `Ваша ссылка на зеркало: ${mirrorUrl}`);
        return { success: true, link: mirrorUrl };
    }
}
