import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';

@Injectable()
export class TelegramService {
    private readonly logger = new Logger(TelegramService.name);

    constructor(
        @InjectBot() private readonly bot: Telegraf,
    ) {
    }

    async sendMessage(chatId: number, text: string) {
        try {
            await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
        } catch (error) {
            this.logger.error(`Ошибка Telegram API (User: ${chatId}):`, error);
            throw error;
        }
    }
}
