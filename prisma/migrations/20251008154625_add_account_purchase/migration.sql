-- CreateTable
CREATE TABLE "account_purchase" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "buyer_telegram_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_purchase_account_id_idx" ON "account_purchase"("account_id");

-- AddForeignKey
ALTER TABLE "account_purchase" ADD CONSTRAINT "account_purchase_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_purchase" ADD CONSTRAINT "account_purchase_buyer_telegram_id_fkey" FOREIGN KEY ("buyer_telegram_id") REFERENCES "user_telegram"("telegram_id") ON DELETE RESTRICT ON UPDATE CASCADE;
