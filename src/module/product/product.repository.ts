import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateOrUpdateProductParams, ProductSearchParams } from './product.interface';

@Injectable()
export class ProductRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findInfosByProductIds(productIds: string[]): Promise<
        Array<{
            productId: string;
            article: string;
            sku: string | null;
        }>
    > {
        if (!productIds.length) return [];

        return this.prisma.productInfo.findMany({
            where: { productId: { in: productIds } },
            select: {
                productId: true,
                article: true,
                sku: true,
            },
        });
    }

    /**
     * Собираем where-условие для поиска ProductInfo по productId / article / sku
     */
    private buildProductInfoWhere(params: ProductSearchParams): Prisma.ProductInfoWhereInput {
        const { productId, article, sku } = params;
        const or: Prisma.ProductInfoWhereInput[] = [];

        if (productId) {
            or.push({ productId });
        }
        if (article) {
            or.push({ article });
        }
        if (sku) {
            or.push({ sku });
        }

        if (or.length === 0) {
            throw new Error('ProductSearchParams must contain at least one of: productId, article, sku');
        }

        return { OR: or };
    }

    async findProductInfoWithProduct(params: ProductSearchParams) {
        const where = this.buildProductInfoWhere(params);

        return this.prisma.productInfo.findFirst({
            where,
            include: {
                product: true,
            },
        });
    }

    async findNodeByAnyIdentifier(params: ProductSearchParams): Promise<string | null> {
        const record = await this.findProductInfoWithProduct(params);
        return record?.product?.node ?? null;
    }

    async createOrUpdateProductWithInfo(data: CreateOrUpdateProductParams) {
        const { productId, node, article, sku } = data;

        return this.prisma.product.upsert({
            where: { productId },
            update: {
                node,
            },
            create: {
                productId,
                node,
                productInfo: {
                    create: {
                        article,
                        sku,
                    },
                },
            },
        });
    }

    async addProductInfo(data: { productId: string; article: string; sku?: string | null }) {
        const { productId, article, sku } = data;

        return this.prisma.productInfo.create({
            data: {
                productId,
                article,
                sku,
            },
        });
    }
}
