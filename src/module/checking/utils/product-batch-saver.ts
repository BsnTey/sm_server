import { Logger } from '@nestjs/common';
import { AccountDiscountService } from '../account-discount.service';
import { CreatePersonalDiscountProductsInput } from '../interfaces/account-discount.interface';

export class ProductBatchSaver {
    // Используем Map для дедупликации SKU "на лету"
    private infoBuffer = new Map<string, { productId: string; article: string; sku: string | null }>();
    private discountBuffer: CreatePersonalDiscountProductsInput[] = [];
    private readonly FLUSH_THRESHOLD = 1000;

    constructor(
        private readonly service: AccountDiscountService,
        private readonly logger: Logger,
    ) {}

    /**
     * Добавляет связь Аккаунт-Продукт-Нода
     */
    addDiscount(item: CreatePersonalDiscountProductsInput): boolean {
        this.discountBuffer.push(item);
        return this.isFull();
    }

    /**
     * Добавляет справочную информацию о продукте (Артикул/SKU)
     */
    addInfo(productId: string, article: string, sku: string | null): boolean {
        // Ключ уникальности: ID + Артикул + SKU
        const key = `${productId}|${article}|${sku}`;
        if (!this.infoBuffer.has(key)) {
            this.infoBuffer.set(key, { productId, article, sku });
        }
        return this.isFull();
    }

    private isFull(): boolean {
        return this.discountBuffer.length >= this.FLUSH_THRESHOLD || this.infoBuffer.size >= this.FLUSH_THRESHOLD;
    }

    /**
     * Принудительно сбрасывает накопленные данные в БД
     */
    async flush() {
        if (this.discountBuffer.length === 0 && this.infoBuffer.size === 0) return;

        const promises: Promise<any>[] = [];

        // 1. Сохраняем справочники (ProductInfo)
        if (this.infoBuffer.size > 0) {
            const infos = Array.from(this.infoBuffer.values());
            this.infoBuffer.clear();
            promises.push(this.service.bulkSaveProductInfos(infos).catch(e => this.logger.error('Error saving ProductInfos', e)));
        }

        // 2. Сохраняем скидки (DiscountProducts)
        if (this.discountBuffer.length > 0) {
            const batch = [...this.discountBuffer];
            this.discountBuffer = []; // Очистка ссылки
            promises.push(this.service.bulkSaveDiscountProducts(batch).catch(e => this.logger.error('Error saving DiscountProducts', e)));
        }

        await Promise.all(promises);
    }
}
