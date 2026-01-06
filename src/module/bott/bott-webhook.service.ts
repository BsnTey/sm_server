import * as cheerio from 'cheerio';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OrderApiWebhook } from './interfaces/order-webhook.interface';
import { AccountService } from '../account/account.service';
import { BottPurchaseService } from './bott-purchase.service';
import { ParsedOrder } from './interfaces/purchase-repository';

@Injectable()
export class BottWebhookService {
    private readonly logger = new Logger(BottWebhookService.name);

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

    async importOrdersFromHtml(html: string): Promise<number> {
        let savedCount = 0;
        const $ = cheerio.load(html);
        const parsedOrders: ParsedOrder[] = [];

        // 1. Пробегаемся по всем строкам таблицы
        $('tr[data-key]').each((_, element) => {
            try {
                const orderData = this.parseSingleOrderRow($, element);
                if (orderData) {
                    parsedOrders.push(orderData);
                }
            } catch (e: any) {
                this.logger.error(`Failed to parse row: ${e.message}`);
            }
        });

        if (parsedOrders.length === 0) {
            return 0;
        }

        // 2. СОРТИРОВКА: От старых к новым
        parsedOrders.sort((a, b) => a.purchasedAt.getTime() - b.purchasedAt.getTime());

        this.logger.log(`Found ${parsedOrders.length} orders. Processing chronologically...`);

        // 3. Сохранение в БД
        for (const order of parsedOrders) {
            await this.processAndSaveOrder(order);
            savedCount++;
        }
        return savedCount;
    }

    private parseSingleOrderRow($: cheerio.CheerioAPI, element: any): ParsedOrder | null {
        const $row = $(element);
        const orderId = $row.attr('data-key');
        if (!orderId) return null;

        // TG_ID
        let buyerTelegramId = '';
        const tgLink = $row.find('a[href^="tg://user?id="]').attr('href');
        if (tgLink) {
            buyerTelegramId = tgLink.split('=')[1];
        } else {
            const clientCell = $row.find('td[aria-label="Клиент"]');
            clientCell.find('.nav-item').each((_, el) => {
                if ($(el).text().includes('TG_ID:')) {
                    buyerTelegramId = $(el).find('.badge').text().trim();
                }
            });
        }

        if (!buyerTelegramId) {
            this.logger.warn(`Skipping order ${orderId}: No TG_ID found`);
            return null;
        }

        // Дата
        const dateText = $row.find('td[aria-label="Время покупки"]').text().trim();
        const purchasedAt = this.parseHtmlDate(dateText);

        // Сумма и кол-во
        const priceCountText = $row.find('td[aria-label="Сумма покупки/количество"]').text().trim();
        const priceMatch = priceCountText.match(/(\d+)\s*₽\/(\d+)\s*шт/);
        const totalAmount = priceMatch ? Number(priceMatch[1]) : 0;
        const totalCount = priceMatch ? Number(priceMatch[2]) : 1;

        // Товары
        let $productDataContainer = $row.find('.show_more_full_text');
        if (!$productDataContainer.length) {
            $productDataContainer = $row.find('td:has(span[id^="show_more_sub_id"])');
            if (!$productDataContainer.length) {
                $productDataContainer = $row.find('td[aria-label="Товар"]');
            }
        }

        let rawHtml = $productDataContainer.html() || '';
        rawHtml = rawHtml.replace(/<br\s*\/?>/gi, '\n');
        const rawProductData = cheerio.load(rawHtml).text().trim();

        const items = this.extractAccountItemsWithRaw(rawProductData, totalCount);

        if (items.length === 0) {
            this.logger.warn(`Skipping order ${orderId}: No valid account items found`);
            return null;
        }

        return {
            orderId,
            buyerTelegramId,
            purchasedAt,
            items,
            rawProductData,
            totalAmount,
        };
    }

    private async processAndSaveOrder(order: ParsedOrder) {
        // Рассчитываем цену за единицу
        const unitAmount = Math.floor(order.totalAmount / Math.max(1, order.items.length));

        for (let i = 0; i < order.items.length; i++) {
            const { accountId, hasPromoCode, rawLine } = order.items[i];

            // 1. Смена владельца (Актуально, так как мы идем от старых заказов к новым)
            // Если аккаунт перепродавался, последний вызов перезапишет владельца.
            await this.accountService.changeOwner(accountId, order.buyerTelegramId);

            const lineIndex = i + 1;
            // Уникальный ID покупки: OrderID-LineIndex (для групповых) или просто OrderID
            const id = order.items.length > 1 ? `${order.orderId}-${lineIndex}` : order.orderId;

            // Формируем "Fake Payload" чтобы сохранить историю строки
            const fakePayload = {
                id: order.orderId,
                status: 'IMPORTED_HTML',
                product: { data: rawLine },
                _lineIndex: lineIndex,
                original_full_data: order.rawProductData,
            };

            try {
                await this.bottPurchaseService.createPurchase({
                    id,
                    orderNumber: order.orderId,
                    lineIndex,
                    accountId,
                    buyerTelegramId: order.buyerTelegramId,
                    amount: unitAmount,
                    purchasedAt: order.purchasedAt,
                    rawPayload: JSON.parse(JSON.stringify(fakePayload)),
                    hasPromoCode,
                });
            } catch (e: any) {
                if (e?.code === 'P2002') {
                    await this.bottPurchaseService.updatePurchase(id, order.purchasedAt, hasPromoCode);
                    continue;
                }
                this.logger.error(`Error saving purchase ${id}: ${e.message}`);
            }
        }
    }

    private extractAccountItems(raw: string, expectedCount: number): Array<{ accountId: string; hasPromoCode: boolean }> {
        // Переиспользуем логику extractAccountItemsWithRaw, отбрасывая rawLine
        return this.extractAccountItemsWithRaw(raw, expectedCount).map(({ accountId, hasPromoCode }) => ({ accountId, hasPromoCode }));
    }

    private extractAccountItemsWithRaw(
        raw: string,
        expectedCount: number,
    ): Array<{ accountId: string; hasPromoCode: boolean; rawLine: string }> {
        if (!raw) return [];

        // Разбиваем на строки, чистим пустые
        const lines = raw
            .split(/\r?\n/)
            .map(s => s.trim())
            .filter(line => line.length > 10); // Фильтр "мусора"

        const result: Array<{ accountId: string; hasPromoCode: boolean; rawLine: string }> = [];

        // 1. Если это список (несколько строк или ожидается > 1)
        if (lines.length > 1 || expectedCount > 1) {
            for (const ln of lines) {
                // ВАЖНО: Удаляем нумерацию "1) " здесь, чтобы parseLine получил чистую строку
                const cleanLine = ln.replace(/^\d+\)\s*/, '');

                const parsed = this.parseLine(cleanLine);
                if (parsed) {
                    result.push({ ...parsed, rawLine: ln });
                }
            }
        } else {
            // 2. Одиночный товар (может быть без переносов строк)
            const cleanLine = raw.replace(/^\d+\)\s*/, ''); // На всякий случай чистим
            const single = this.parseLine(cleanLine);
            if (single) {
                result.push({ ...single, rawLine: raw });
            }
        }

        return result;
    }

    // --- Вспомогательные методы ---

    private parseHtmlDate(dateStr: string): Date {
        // "2026-01-05 15:40" -> Date
        if (!dateStr) return new Date();
        const isoLike = dateStr.replace(' ', 'T') + ':00';
        const date = new Date(isoLike);
        return isNaN(date.getTime()) ? new Date() : date;
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
            const hasPromoCode = this.detectPromoPrefix(tokens);
            return { accountId: uuid, hasPromoCode };
        }

        const guess = tokens[0] ?? null;
        if (guess && this.looksLikeAccountId(guess)) {
            const hasPromoCode = this.detectPromoPrefix(tokens);
            return { accountId: guess, hasPromoCode };
        }

        return null;
    }

    private extractUuid(s: string): string | null {
        const uuidRe = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
        const m = s.match(uuidRe);
        return m ? m[0] : null;
    }

    private detectPromoPrefix(tokens: string[]): boolean {
        // Логика: Если токенов >= 3 и первый похож на промо, второй на дату
        if (tokens.length < 3) return false;

        // Индексы могут сместиться, если есть нумерация, но мы её убрали в extractAccountItems
        const [maybePromo, maybeDate] = tokens;

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
