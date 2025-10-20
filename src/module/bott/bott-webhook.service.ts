import { Injectable } from '@nestjs/common';
import { OrderApiWebhook } from './interfaces/order-webhook.interface';
import { AccountService } from '../account/account.service';
import { BottPurchaseService } from './bott-purchase.service';

@Injectable()
export class BottWebhookService {
    constructor(
        private readonly accountService: AccountService,
        private readonly bottPurchaseService: BottPurchaseService,
    ) {}

    async create(dto: OrderApiWebhook): Promise<string> {
        const buyerTelegramId = dto?.user?.telegram_id;
        if (!buyerTelegramId) throw new Error('buyer telegram id is required');

        const expectedCount = Number(dto?.count ?? 1) || 1;
        const dataStr = dto?.product?.data || '';
        const accountIds = this.extractAccountIds(dataStr, expectedCount);
        if (!accountIds.length) throw new Error('accountIds not found');

        const unitAmount =
            Number(dto?.category?.price?.amount ?? 0) || Math.floor((Number(dto?.amount ?? 0) || 0) / Math.max(1, accountIds.length));

        const purchasedAt = this.computePurchasedAt(dto?.created_at, 3);
        const orderNumber = String(dto.id);

        for (let i = 0; i < accountIds.length; i++) {
            const accountId = accountIds[i];
            await this.accountService.changeOwner(accountId, buyerTelegramId);

            const lineIndex = i + 1;
            const id = accountIds.length > 1 ? `${orderNumber}-${lineIndex}` : orderNumber;

            const rawPayload = JSON.parse(JSON.stringify({ ...dto, _lineIndex: lineIndex }));

            try {
                await this.bottPurchaseService.createPurchase({
                    id,
                    orderNumber,
                    lineIndex,
                    accountId,
                    buyerTelegramId,
                    amount: unitAmount,
                    purchasedAt,
                    rawPayload,
                });
            } catch (e: any) {
                if (e?.code === 'P2002') {
                    continue;
                }
                throw e;
            }
        }

        return 'ok';
    }

    private extractAccountIds(raw: string, expectedCount: number): string[] {
        if (!raw) return [];

        const lines = raw
            .split(/\r?\n/)
            .map(s => s.trim())
            .filter(Boolean);
        if (lines.length > 1 || expectedCount > 1) {
            const result: string[] = [];
            for (const ln of lines) {
                const id = this.extractAccountIdFromLine(ln);
                if (id) result.push(id);
            }
            return result;
        }

        const single = this.extractAccountIdFromLine(raw);
        return single ? [single] : [];
    }

    private extractAccountIdFromLine(line: string): string | null {
        if (!line) return null;

        const uuidRe = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
        const m = line.match(uuidRe);
        if (m) return m[0];

        const beforeJson = line.split('[')[0] ?? line;
        const tokens = beforeJson
            .trim()
            .split(/[\s\t]+/)
            .filter(Boolean);

        if (tokens[0] && this.looksLikeAccountId(tokens[0])) return tokens[0];
        if (tokens[2] && this.looksLikeAccountId(tokens[2])) return tokens[2];

        return tokens[0] ?? null;
    }

    private looksLikeAccountId(s: string): boolean {
        if (!s) return false;
        if (/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(s)) return true;
        return /^[a-z0-9-]{9,}$/i.test(s);
    }

    private computePurchasedAt(createdAt: string | undefined, offsetHours: number): Date {
        if (!createdAt) return new Date();

        const isoUtc = `${createdAt.replace(' ', 'T')}:00Z`;
        const base = new Date(isoUtc);
        if (isNaN(base.getTime())) return new Date();

        return new Date(base.getTime() + offsetHours * 60 * 60 * 1000);
    }
}
