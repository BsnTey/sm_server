/*
  Warnings:

  - You are about to drop the column `amountCredited` on the `payment_order` table. All the data in the column will be lost.
  - You are about to drop the column `id_bot_t` on the `payment_order` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[transaction_id]` on the table `payment_order` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `amount_credited` to the `payment_order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Альтерирование таблицы payment_order
 ALTER TABLE "payment_order"
     DROP COLUMN "amountCredited",
     DROP COLUMN "id_bot_t",
     ADD COLUMN "amount_credited" INTEGER NOT NULL DEFAULT 0,
     ADD COLUMN "transaction_id" INTEGER;

 -- Создание уникального индекса для transaction_id
 CREATE UNIQUE INDEX "payment_order_transaction_id_key" ON "payment_order"("transaction_id");

