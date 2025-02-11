/*
  Warnings:

  - You are about to drop the column `redeemedAt` on the `fortune_surprise` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "fortune_surprise" DROP COLUMN "redeemedAt",
ADD COLUMN     "redeemed_at" TIMESTAMP(3);
