-- CreateTable
CREATE TABLE "account_mirror" (
    "id" UUID NOT NULL,
    "telegram_id" TEXT NOT NULL,
    "telegram_name" TEXT NOT NULL,
    "account_id" TEXT,
    "user_ip" TEXT,
    "mirror_token" TEXT,
    "mirror_token_expiry" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_mirror_pkey" PRIMARY KEY ("id")
);
