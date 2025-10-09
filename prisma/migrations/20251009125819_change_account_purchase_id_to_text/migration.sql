/*
  Warnings:

  - The primary key for the `account_purchase` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "account_purchase" DROP CONSTRAINT "account_purchase_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "account_purchase_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "account_purchase_id_seq";
