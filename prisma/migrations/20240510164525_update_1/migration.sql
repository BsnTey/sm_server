/*
  Warnings:

  - You are about to drop the column `userOwnerId` on the `account` table. All the data in the column will be lost.
  - The primary key for the `city_sm` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `cityId` on the `city_sm` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `city_sm` table. All the data in the column will be lost.
  - The primary key for the `user` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `count_bonuses` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `is_ban` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `telegram_id` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `telegram_name` on the `user` table. All the data in the column will be lost.
  - The primary key for the `user_city_sm` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `user_id` on the `user_city_sm` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[city_id]` on the table `city_sm` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userTelegramId]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `city_id` to the `city_sm` table without a default value. This is not possible if the table is not empty.
  - Added the required column `full_name` to the `city_sm` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userTelegramId` to the `user` table without a default value. This is not possible if the table is not empty.
  - The required column `uuid` was added to the `user` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Made the column `first_name` on table `user` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `user` required. This step will fail if there are existing NULL values in that column.
  - Made the column `password_hash` on table `user` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `user_telegram_id` to the `user_city_sm` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "account" DROP CONSTRAINT "account_userOwnerId_fkey";

-- DropForeignKey
ALTER TABLE "user_city_sm" DROP CONSTRAINT "user_city_sm_city_id_fkey";

-- DropForeignKey
ALTER TABLE "user_city_sm" DROP CONSTRAINT "user_city_sm_user_id_fkey";

-- DropIndex
DROP INDEX "user_telegram_id_key";

-- AlterTable
ALTER TABLE "account" DROP COLUMN "userOwnerId",
ADD COLUMN     "ownerTelegramId" TEXT NOT NULL DEFAULT '750126398';

-- AlterTable
ALTER TABLE "city_sm" DROP CONSTRAINT "city_sm_pkey",
DROP COLUMN "cityId",
DROP COLUMN "fullName",
ADD COLUMN     "city_id" TEXT NOT NULL,
ADD COLUMN     "full_name" TEXT NOT NULL,
ADD CONSTRAINT "city_sm_pkey" PRIMARY KEY ("city_id");

-- AlterTable
ALTER TABLE "user" DROP CONSTRAINT "user_pkey",
DROP COLUMN "count_bonuses",
DROP COLUMN "is_ban",
DROP COLUMN "telegram_id",
DROP COLUMN "telegram_name",
ADD COLUMN     "userTelegramId" TEXT NOT NULL,
ADD COLUMN     "uuid" UUID NOT NULL,
ALTER COLUMN "first_name" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "password_hash" SET NOT NULL,
ADD CONSTRAINT "user_pkey" PRIMARY KEY ("uuid");

-- AlterTable
ALTER TABLE "user_city_sm" DROP CONSTRAINT "user_city_sm_pkey",
DROP COLUMN "user_id",
ADD COLUMN     "user_telegram_id" TEXT NOT NULL,
ADD CONSTRAINT "user_city_sm_pkey" PRIMARY KEY ("city_id", "user_telegram_id");

-- CreateTable
CREATE TABLE "user_telegram" (
    "telegram_id" TEXT NOT NULL,
    "telegram_name" TEXT NOT NULL,
    "count_bonuses" INTEGER NOT NULL DEFAULT 0,
    "is_ban" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_telegram_pkey" PRIMARY KEY ("telegram_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_telegram_telegram_id_key" ON "user_telegram"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "city_sm_city_id_key" ON "city_sm"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_userTelegramId_key" ON "user"("userTelegramId");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_userTelegramId_fkey" FOREIGN KEY ("userTelegramId") REFERENCES "user_telegram"("telegram_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_ownerTelegramId_fkey" FOREIGN KEY ("ownerTelegramId") REFERENCES "user_telegram"("telegram_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_city_sm" ADD CONSTRAINT "user_city_sm_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "city_sm"("city_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_city_sm" ADD CONSTRAINT "user_city_sm_user_telegram_id_fkey" FOREIGN KEY ("user_telegram_id") REFERENCES "user_telegram"("telegram_id") ON DELETE RESTRICT ON UPDATE CASCADE;
