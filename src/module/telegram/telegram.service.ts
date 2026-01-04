import { Injectable, Logger } from '@nestjs/common';
import { Ctx, InjectBot } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { getValueKeysMenu } from './updates/base-command/base-command.constants';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';

@Injectable()
export class TelegramService {
    private readonly logger = new Logger(TelegramService.name);
    private readonly adminsId: string[];

    constructor(
        private configService: ConfigService,
        @InjectBot() private readonly bot: Telegraf,
    ) {
        this.adminsId = this.configService.getOrThrow('TELEGRAM_ADMIN_ID').split(',');
    }

    async exitScene(menuBtn: string, @Ctx() ctx: WizardContext) {
        await ctx.scene.leave();
        const scene = getValueKeysMenu(menuBtn);
        if (scene) {
            return await ctx.scene.enter(scene);
        }
    }

    async sendMessage(chatId: number, text: string) {
        try {
            await this.bot.telegram.sendMessage(chatId, text);
        } catch (error) {
            this.logger.error('Ошибка при отправке сообщения:', error);
        }
    }

    async sendAdminMessage(text: string) {
        const adminId = this.adminsId[0];
        try {
            await this.bot.telegram.sendMessage(adminId, text);
        } catch (error) {
            this.logger.error('Ошибка при отправке сообщения:', error);
        }
    }
}
