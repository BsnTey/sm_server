-- CreateTable
CREATE TABLE "account_discount" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "telegram_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "node_name" TEXT NOT NULL,
    "date_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_discount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_discount_telegram_id_account_id_idx" ON "account_discount"("telegram_id", "account_id");

-- CreateIndex
CREATE INDEX "account_discount_telegram_id_node_id_idx" ON "account_discount"("telegram_id", "node_id");

-- CreateIndex
CREATE INDEX "account_discount_node_id_account_id_idx" ON "account_discount"("node_id", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_discount_account_id_node_id_key" ON "account_discount"("account_id", "node_id");
