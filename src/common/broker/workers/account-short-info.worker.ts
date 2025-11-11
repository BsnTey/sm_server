import { Injectable, Logger } from '@nestjs/common';
import { AccountService } from '../../../module/account/account.service';

interface AccountShortInfoJob {
    accountId: string;
}

@Injectable()
export class AccountShortInfoWorker {
    private readonly logger = new Logger(AccountShortInfoWorker.name);

    constructor(private readonly accounts: AccountService) {}

    async process(buf: Buffer): Promise<void> {
        let payload: AccountShortInfoJob;

        try {
            payload = JSON.parse(buf.toString('utf8'));
        } catch (error) {
            this.logger.error('Received invalid account short info payload (JSON parse failed)', error as Error);
            return;
        }

        if (!payload?.accountId) {
            this.logger.error('Account short info payload missing accountId');
            return;
        }

        await this.accounts.shortInfo(payload.accountId);
    }
}
