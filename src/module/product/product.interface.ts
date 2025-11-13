export interface ProductSearchParams {
    productId?: string;
    article?: string;
    sku?: string;
}

export interface ProductSearchParams {
    productId?: string;
    article?: string;
    sku?: string;
}

export interface CreateOrUpdateProductParams {
    productId: string;
    node: string;
    article: string;
    sku?: string | null;
}
