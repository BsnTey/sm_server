import { Injectable, Logger } from '@nestjs/common';
import { PersonalDiscountChunkWorkerPayload } from '../../../module/checking/interfaces/queqe.interface';
import { CheckingService } from '../../../module/checking/checking.service';

@Injectable()
export class PersonalDiscountProductWorker {
    private readonly logger = new Logger(PersonalDiscountProductWorker.name);

    constructor(private readonly checkingService: CheckingService) {}

    async process(buf: Buffer) {
        let data: PersonalDiscountChunkWorkerPayload;
        try {
            data = JSON.parse(buf.toString());
        } catch (e) {
            this.logger.error('Failed to parse payload', e);
            return;
        }

        this.logger.log(`Processed chunk ${data.count}/${data.total} for telegramId=${data.telegramId}`);

        const { count, total, telegramId } = data;
        const logPrefix = `[Chunk ${count ?? '?'}/${total ?? '?'}]`;

        try {
            await this.checkingService.setAccountsDiscountProduct(data);

            this.logger.log(`${logPrefix} Successfully processed for result worker for TG: ${telegramId}`);
        } catch (error) {
            this.logger.error(`${logPrefix} Failed to process chunk for result worker for TG: ${telegramId}`, error);
            throw error;
        }
    }
}
