/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StatusPayment" AS ENUM ('Created', 'AwaitingTransfer', 'AwaitingReceipt', 'Completed', 'Cancelled');

-- CreateTable
CREATE TABLE "payment_order" (
    "id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "StatusPayment" NOT NULL DEFAULT 'Created',
    "receipt_url" TEXT,
    "completed_at" TIMESTAMP(3),
    "user_telegram_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_order_status_history" (
    "id" SERIAL NOT NULL,
    "payment_order_id" UUID NOT NULL,
    "status" "StatusPayment" NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_order_user_telegram_id_idx" ON "payment_order"("user_telegram_id");

-- CreateIndex
CREATE INDEX "payment_order_status_idx" ON "payment_order"("status");

-- CreateIndex
CREATE INDEX "payment_order_status_history_payment_order_id_idx" ON "payment_order_status_history"("payment_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- AddForeignKey
ALTER TABLE "payment_order" ADD CONSTRAINT "payment_order_user_telegram_id_fkey" FOREIGN KEY ("user_telegram_id") REFERENCES "user_telegram"("telegram_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_order_status_history" ADD CONSTRAINT "payment_order_status_history_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
