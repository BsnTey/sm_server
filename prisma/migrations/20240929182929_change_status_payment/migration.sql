/*
  Warnings:

  - The values [AwaitingTransfer,AwaitingReceipt] on the enum `StatusPayment` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `amountCredited` to the `payment_order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StatusPayment_new" AS ENUM ('Created', 'Transfered', 'Completed', 'Cancelled', 'Proceedings');
ALTER TABLE "payment_order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "payment_order" ALTER COLUMN "status" TYPE "StatusPayment_new" USING ("status"::text::"StatusPayment_new");
ALTER TABLE "payment_order_status_history" ALTER COLUMN "status" TYPE "StatusPayment_new" USING ("status"::text::"StatusPayment_new");
ALTER TYPE "StatusPayment" RENAME TO "StatusPayment_old";
ALTER TYPE "StatusPayment_new" RENAME TO "StatusPayment";
DROP TYPE "StatusPayment_old";
ALTER TABLE "payment_order" ALTER COLUMN "status" SET DEFAULT 'Created';
COMMIT;

-- AlterTable
ALTER TABLE "payment_order" ADD COLUMN     "amountCredited" INTEGER NOT NULL;
