import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from '../../../module/telegram/telegram.service';

export interface MessagesToTelegramPayload {
    telegramId: string | number;
    message: string;
}

@Injectable()
export class MessagesToTelegramWorker {
    private readonly logger = new Logger(MessagesToTelegramWorker.name);

    constructor(private readonly telegramService: TelegramService) { }

    async process(payload: Buffer): Promise<void> {
        const data: MessagesToTelegramPayload = JSON.parse(payload.toString());
        const { telegramId, message } = data;

        if (!telegramId || !message) {
            this.logger.warn(`Invalid payload for MessagesToTelegramWorker: ${JSON.stringify(data)}`);
            return;
        }

        try {
            await this.telegramService.sendMessage(Number(telegramId), message);
        } catch (e) {
            this.logger.error(`Failed to send message to ${telegramId}`, e);
            throw e; // Re-throw to trigger retry mechanism
        }
    }
}
