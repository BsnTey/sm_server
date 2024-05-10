/*
  Warnings:

  - You are about to drop the column `refresh_oken` on the `account` table. All the data in the column will be lost.
  - Added the required column `refresh_token` to the `account` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "account" DROP COLUMN "refresh_oken",
ADD COLUMN     "refresh_token" TEXT NOT NULL;
