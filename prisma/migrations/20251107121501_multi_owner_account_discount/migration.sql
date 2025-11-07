/*
  Warnings:

  - A unique constraint covering the columns `[account_id,node_id,telegram_id]` on the table `account_discount` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "account_discount_account_id_node_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "account_discount_account_id_node_id_telegram_id_key" ON "account_discount"("account_id", "node_id", "telegram_id");
