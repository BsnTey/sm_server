-- AlterTable
ALTER TABLE "order" ADD COLUMN     "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "idx_order_account_date" ON "order"("account_id", "date");
UPDATE "order" SET "date" = "created_at" WHERE "date" IS NULL;
