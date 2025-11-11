-- CreateTable
CREATE TABLE "account_discount_product" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "telegram_id" INTEGER NOT NULL,
    "account_id" TEXT NOT NULL,
    "date_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_discount_product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_discount_product_product_id_telegram_id_idx" ON "account_discount_product"("product_id", "telegram_id");

-- CreateIndex
CREATE INDEX "account_discount_product_account_id_idx" ON "account_discount_product"("account_id");

-- CreateIndex
CREATE INDEX "account_discount_product_telegram_id_idx" ON "account_discount_product"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_discount_product_product_id_telegram_id_account_id_key" ON "account_discount_product"("product_id", "telegram_id", "account_id");
