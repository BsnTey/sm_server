import { Injectable, Logger } from '@nestjs/common';
import { SetPersonalDiscountAccountCommand } from '../../../module/checking/dto/set-personal-discount.dto';
import { CheckingService } from '../../../module/checking/checking.service';

@Injectable()
export class PersonalDiscountInputWorker {
    private readonly logger = new Logger(PersonalDiscountInputWorker.name);

    constructor(private readonly checkingService: CheckingService) {}

    async process(buf: Buffer) {
        let payload: SetPersonalDiscountAccountCommand.Request;

        try {
            payload = SetPersonalDiscountAccountCommand.RequestSchema.parse(JSON.parse(buf.toString('utf8')));
        } catch (error) {
            this.logger.error('Received invalid personal discount job payload', error);
            return;
        }

        await this.checkingService.chunkingAccountForProxy(payload);
    }
}
