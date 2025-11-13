import { Injectable } from '@nestjs/common';
import { ProductRepository } from './product.repository';
import { ProductSearchParams } from './product.interface';

@Injectable()
export class ProductService {
    constructor(private readonly productRepository: ProductRepository) {}

    async getNode(params: ProductSearchParams): Promise<string | null> {
        return this.productRepository.findNodeByAnyIdentifier(params);
    }

    async getProductInfoWithProduct(params: ProductSearchParams) {
        return this.productRepository.findProductInfoWithProduct(params);
    }

    async saveProductWithInfo(data: { productId: string; node: string; article: string; sku?: string | null }) {
        return this.productRepository.createOrUpdateProductWithInfo(data);
    }

    async addProductInfo(data: { productId: string; article: string; sku?: string | null }) {
        return this.productRepository.addProductInfo(data);
    }

    async getProductInfosByProductIds(productIds: string[]) {
        return this.productRepository.findInfosByProductIds(productIds);
    }
}
