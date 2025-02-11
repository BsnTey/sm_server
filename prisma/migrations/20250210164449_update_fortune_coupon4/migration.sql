-- AlterTable
ALTER TABLE "payment_order" ADD COLUMN     "couponApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "couponId" UUID;

-- AddForeignKey
ALTER TABLE "payment_order" ADD CONSTRAINT "payment_order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "fortune_surprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
