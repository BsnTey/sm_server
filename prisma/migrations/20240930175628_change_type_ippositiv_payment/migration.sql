/*
  Warnings:

  - The `is_positive` column on the `payment_order` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "payment_order" DROP COLUMN "is_positive",
ADD COLUMN     "is_positive" BOOLEAN;
