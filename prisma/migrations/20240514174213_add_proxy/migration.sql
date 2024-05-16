-- AlterTable
ALTER TABLE "account"
ADD COLUMN "city_id" TEXT NOT NULL DEFAULT '1720920299',
ADD COLUMN "owner_telegram_id" TEXT NOT NULL DEFAULT '750126398',
ADD COLUMN "proxy_uuid" UUID;

-- Copy data from ownerTelegramId to owner_telegram_id
UPDATE "account" SET "owner_telegram_id" = "ownerTelegramId";

-- DropForeignKey
ALTER TABLE "account" DROP CONSTRAINT "account_ownerTelegramId_fkey";

-- RenameColumn
ALTER TABLE "account" RENAME COLUMN "ownerTelegramId" TO "temp_ownerTelegramId";

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_owner_telegram_id_fkey" FOREIGN KEY ("owner_telegram_id") REFERENCES "user_telegram"("telegram_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropColumn
ALTER TABLE "account" DROP COLUMN "temp_ownerTelegramId";

-- CreateTable
CREATE TABLE "proxy" (
    "uuid" UUID NOT NULL,
    "proxy" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "blocked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxy_pkey" PRIMARY KEY ("uuid")
);

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_proxy_uuid_fkey" FOREIGN KEY ("proxy_uuid") REFERENCES "proxy"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
