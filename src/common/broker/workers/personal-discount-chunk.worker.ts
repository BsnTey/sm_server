import { Injectable, Logger } from '@nestjs/common';
import { CheckingService } from '../../../module/checking/checking.service';
// Импортируем интерфейс. Убедитесь, что он определен так же, как отправляет продюсер.
import { PersonalDiscountChunkWorkerPayload } from '../../../module/checking/interfaces/queqe.interface';

@Injectable()
export class PersonalDiscountChunkWorker {
    private readonly logger = new Logger(PersonalDiscountChunkWorker.name);

    constructor(private readonly checkingService: CheckingService) {}

    async process(buf: Buffer): Promise<void> {
        let payload: PersonalDiscountChunkWorkerPayload;

        try {
            payload = JSON.parse(buf.toString('utf8'));
        } catch (error) {
            this.logger.error('Received invalid JSON payload', error);
            return;
        }

        const { telegramId, accounts, count, total } = payload;
        const logPrefix = `[Chunk ${count ?? '?'}/${total ?? '?'}]`;

        this.logger.log(`${logPrefix} Processing ${accounts.length} accounts for TG: ${telegramId}`);

        try {
            await this.checkingService.setAccountsForNodes(payload);

            this.logger.log(`${logPrefix} Successfully processed chunk worker for TG: ${telegramId}`);
        } catch (error) {
            this.logger.error(`${logPrefix} Failed to process chunk chunk worker for TG: ${telegramId}`, error);
            throw error;
        }
    }
}
