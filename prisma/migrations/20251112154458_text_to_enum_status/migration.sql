/*
  Warnings:

  - The `commission_type` column on the `user_template` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('BONUS', 'PROMO', 'TOTAL');

-- AlterTable
ALTER TABLE "user_template" DROP COLUMN "commission_type",
ADD COLUMN     "commission_type" "CommissionType" NOT NULL DEFAULT 'TOTAL';
