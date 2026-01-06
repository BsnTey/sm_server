import { Injectable } from '@nestjs/common';
import { GateDecision, GateDecisionType } from './interfaces/status.interface';
import { BottPurchaseService } from '../../../bott/bott-purchase.service';

@Injectable()
export class AccessGateService {
    constructor(private readonly bottPurchaseService: BottPurchaseService) {}

    async decide(accountId: string): Promise<GateDecision> {
        const lastPurchase = await this.bottPurchaseService.getLastPurchaseByAccountId(accountId);

        if (!lastPurchase) {
            // нет инфо → можно продолжать, но надо quote (платный сценарий)
            return { type: GateDecisionType.ALLOW_NEED_QUOTE, reason: 'Нет информации о покупке' };
        }

        const { purchasedAt, hasPromoCode } = lastPurchase;
        const diffMs = Date.now() - new Date(purchasedAt).getTime();

        const ONE_DAY = 24 * 60 * 60 * 1000;
        const THREE_DAYS = 3 * ONE_DAY;

        if (hasPromoCode) {
            if (diffMs < THREE_DAYS) return { type: GateDecisionType.DENY, reason: 'Не прошло 3 дня с момента покупки' };
            return { type: GateDecisionType.ALLOW_NEED_QUOTE, reason: 'Истекло время бесплатного доступа' };
        }

        if (diffMs < ONE_DAY) return { type: GateDecisionType.ALLOW_FREE };
        return { type: GateDecisionType.ALLOW_NEED_QUOTE, reason: 'Прошло больше 24 часов с покупки' };
    }
}
