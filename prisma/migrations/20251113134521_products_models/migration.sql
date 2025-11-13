-- CreateTable
CREATE TABLE "product" (
    "product_id" VARCHAR(32) NOT NULL,
    "node" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "product_info" (
    "id" SERIAL NOT NULL,
    "product_id" VARCHAR(32) NOT NULL,
    "article" TEXT NOT NULL,
    "sku" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_info_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_info_product_id_idx" ON "product_info"("product_id");

-- CreateIndex
CREATE INDEX "product_info_article_idx" ON "product_info"("article");

-- CreateIndex
CREATE INDEX "product_info_sku_idx" ON "product_info"("sku");

-- AddForeignKey
ALTER TABLE "product_info" ADD CONSTRAINT "product_info_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;
