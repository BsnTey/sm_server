-- CreateTable
CREATE TABLE "user_template" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "user_telegram_id" TEXT NOT NULL,
    "commission_type" TEXT NOT NULL DEFAULT 'TOTAL',
    "commission_rate" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "round_to" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_template_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "user_template" ADD CONSTRAINT "user_template_user_telegram_id_fkey" FOREIGN KEY ("user_telegram_id") REFERENCES "user_telegram"("telegram_id") ON DELETE RESTRICT ON UPDATE CASCADE;
