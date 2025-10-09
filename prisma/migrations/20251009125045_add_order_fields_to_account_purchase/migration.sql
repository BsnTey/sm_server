/*
  Warnings:

  - The primary key for the `account_purchase` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `account_purchase` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[order_number,line_index]` on the table `account_purchase` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `order_number` to the `account_purchase` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "account_purchase" DROP CONSTRAINT "account_purchase_pkey",
ADD COLUMN     "line_index" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "order_number" TEXT NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "account_purchase_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "account_purchase_order_number_idx" ON "account_purchase"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "account_purchase_order_number_line_index_key" ON "account_purchase"("order_number", "line_index");
