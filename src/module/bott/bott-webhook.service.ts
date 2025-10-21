import { BadRequestException, Injectable } from '@nestjs/common';
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
        if (!buyerTelegramId) throw new BadRequestException('buyer telegram id is required');

        const expectedCount = Number(dto?.count ?? 1) || 1;
        const dataStr = dto?.product?.data || '';

        const items = this.extractAccountItems(dataStr, expectedCount);
        if (!items.length) throw new BadRequestException('accountIds not found');

        const unitAmount =
            Number(dto?.category?.price?.amount ?? 0) || Math.floor((Number(dto?.amount ?? 0) || 0) / Math.max(1, items.length));

        const purchasedAt = this.computePurchasedAt(dto?.created_at, 3);
        const orderNumber = String(dto.id);

        for (let i = 0; i < items.length; i++) {
            const { accountId, hasPromoCode } = items[i];

            await this.accountService.changeOwner(accountId, buyerTelegramId);

            const lineIndex = i + 1;
            const id = items.length > 1 ? `${orderNumber}-${lineIndex}` : orderNumber;

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
                    hasPromoCode,
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

    private extractAccountItems(raw: string, expectedCount: number): Array<{ accountId: string; hasPromoCode: boolean }> {
        if (!raw) return [];

        const lines = raw
            .split(/\r?\n/)
            .map(s => s.trim())
            .filter(Boolean);

        if (lines.length > 1 || expectedCount > 1) {
            const result: Array<{ accountId: string; hasPromoCode: boolean }> = [];
            for (const ln of lines) {
                const parsed = this.parseLine(ln);
                if (parsed) result.push(parsed);
            }
            return result;
        }

        const single = this.parseLine(raw);
        return single ? [single] : [];
    }

    private parseLine(line: string): { accountId: string; hasPromoCode: boolean } | null {
        if (!line) return null;

        const beforeJson = line.split('[')[0] ?? line;
        const tokens = beforeJson
            .trim()
            .split(/[\t ]+/)
            .filter(Boolean);

        const uuid = this.extractUuid(line);
        if (uuid) {
            const hasPromoCode = this.detectPromoPrefix(tokens, uuid);
            return { accountId: uuid, hasPromoCode };
        }

        const guess = tokens[0] ?? null;
        if (guess && this.looksLikeAccountId(guess)) {
            const hasPromoCode = this.detectPromoPrefix(tokens, guess);
            return { accountId: guess, hasPromoCode };
        }

        return null;
    }

    private extractUuid(s: string): string | null {
        const uuidRe = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
        const m = s.match(uuidRe);
        return m ? m[0] : null;
    }

    private detectPromoPrefix(tokens: string[], accountIdInLine: string): boolean {
        if (tokens.length < 3) return false;

        const [maybePromo, maybeDate, maybeAccount] = tokens;

        if (
            this.looksLikePromoCode(maybePromo) &&
            this.looksLikeIsoDate(maybeDate) &&
            (this.isUuid(maybeAccount) || maybeAccount === accountIdInLine)
        ) {
            return true;
        }

        return this.looksLikePromoCode(maybePromo) && this.looksLikeIsoDate(maybeDate);
    }

    private isUuid(s: string): boolean {
        return /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(s);
    }

    private looksLikeIsoDate(s: string): boolean {
        return /^\d{4}-\d{2}-\d{2}$/.test(s);
    }

    private looksLikePromoCode(s: string): boolean {
        return /^[A-Z0-9]{6,16}$/.test(s);
    }

    private looksLikeAccountId(s: string): boolean {
        if (!s) return false;
        if (this.isUuid(s)) return true;
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
