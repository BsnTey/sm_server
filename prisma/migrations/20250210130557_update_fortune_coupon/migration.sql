-- CreateEnum
CREATE TYPE "FortuneSurpriseType" AS ENUM ('Replenish', 'Discount', 'Payment');

-- CreateTable
CREATE TABLE "fortune_surprise" (
    "id" UUID NOT NULL,
    "coupon" TEXT NOT NULL,
    "type" "FortuneSurpriseType" NOT NULL,
    "value" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "maxUsage" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "owner" TEXT NOT NULL,

    CONSTRAINT "fortune_surprise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fortune_surprise_coupon_key" ON "fortune_surprise"("coupon");

-- AddForeignKey
ALTER TABLE "fortune_surprise" ADD CONSTRAINT "fortune_surprise_owner_fkey" FOREIGN KEY ("owner") REFERENCES "user_telegram"("telegram_id") ON DELETE RESTRICT ON UPDATE CASCADE;
