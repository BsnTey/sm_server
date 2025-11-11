import { Injectable, Logger } from '@nestjs/common';
import { AccountService } from '../../../module/account/account.service';
import { SetPersonalDiscountAccountCommand } from '../../../module/account/dto/set-personal-discount.dto';

@Injectable()
export class PersonalDiscountWorker {
    private readonly logger = new Logger(PersonalDiscountWorker.name);

    constructor(private readonly accountService: AccountService) {}

    async process(buf: Buffer): Promise<void> {
        let payload: SetPersonalDiscountAccountCommand.Request;

        try {
            payload = SetPersonalDiscountAccountCommand.RequestSchema.parse(JSON.parse(buf.toString('utf8')));
        } catch (error) {
            this.logger.error('Received invalid personal discount job payload', error);
            return;
        }

        await this.accountService.setAccountsForPersonalDiscountV1(payload);
    }
}
