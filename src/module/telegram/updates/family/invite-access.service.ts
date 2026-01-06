import { Injectable } from '@nestjs/common';
import { AccessGateService } from './access-gate.service';
import { AccessQuoteService } from './access-quote.service';
import { GateDecisionType, InviteAccessResult, InviteAccessType, QuoteType } from './interfaces/status.interface';

@Injectable()
export class InviteAccessService {
    constructor(
        private readonly accessGateService: AccessGateService,
        private readonly accessQuoteService: AccessQuoteService,
    ) {}

    async resolve(accountIdInvited: string): Promise<InviteAccessResult> {
        const gate = await this.accessGateService.decide(accountIdInvited);

        if (gate.type === GateDecisionType.DENY) {
            return { type: InviteAccessType.DENIED, reason: gate.reason };
        }

        if (gate.type === GateDecisionType.ALLOW_FREE) {
            return { type: InviteAccessType.FREE };
        }

        // ALLOW_NEED_QUOTE -> сразу считаем итог
        const quote = await this.accessQuoteService.quote(accountIdInvited);

        if (quote.type === QuoteType.ERROR) {
            return { type: InviteAccessType.ERROR, reason: quote.reason, code: quote.code };
        }

        if (quote.type === QuoteType.FREE) {
            return { type: InviteAccessType.FREE, reason: quote.reason };
        }

        return {
            type: InviteAccessType.PAID,
            priceRub: quote.priceRub,
            bonusBalance: quote.bonusBalance,
            reason: gate.reason,
        };
    }
}
