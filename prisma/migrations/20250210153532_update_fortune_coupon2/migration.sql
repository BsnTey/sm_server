/*
  Warnings:

  - You are about to drop the column `isActive` on the `fortune_surprise` table. All the data in the column will be lost.
  - You are about to drop the column `maxUsage` on the `fortune_surprise` table. All the data in the column will be lost.
  - You are about to drop the column `usageCount` on the `fortune_surprise` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "fortune_surprise" DROP COLUMN "isActive",
DROP COLUMN "maxUsage",
DROP COLUMN "usageCount",
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "max_usage" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "usage_count" INTEGER NOT NULL DEFAULT 0;
