import { Injectable } from '@nestjs/common';
import { AccessPricingConfig, AccessQuote, QuoteType } from './interfaces/status.interface';
import { AccountService } from '../../../account/account.service';

@Injectable()
export class AccessQuoteService {
    constructor(private readonly accountService: AccountService) {}

    async quote(accountId: string): Promise<AccessQuote> {
        const cfg = this.getPricingConfig();

        let bonus: number;
        try {
            const { bonusCount } = await this.accountService.shortInfo(accountId);
            bonus = bonusCount;
        } catch {
            return { type: QuoteType.ERROR, code: 'ACCOUNT_BLOCKED', reason: 'Аккаунт заблокирован/недоступен' };
        }

        if (cfg.enableBonusRule && bonus < cfg.freeIfBonusLessThan) {
            return { type: QuoteType.FREE, reason: `На аккаунте < ${cfg.freeIfBonusLessThan} бонусов` };
        }

        const price = Math.ceil(bonus * cfg.percent);
        return {
            type: QuoteType.PRICE,
            priceRub: price,
            bonusBalance: bonus,
            percent: cfg.percent,
            reason: '',
        };
    }

    private getPricingConfig(): AccessPricingConfig {
        return {
            enableBonusRule: true,
            freeIfBonusLessThan: 500,
            percent: 0.03,
        };
    }
}
