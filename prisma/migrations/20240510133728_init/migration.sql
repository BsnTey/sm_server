-- CreateTable
CREATE TABLE "user" (
    "telegram_id" TEXT NOT NULL,
    "telegram_name" TEXT NOT NULL,
    "first_name" TEXT,
    "email" TEXT,
    "password_hash" TEXT,
    "count_bonuses" INTEGER NOT NULL DEFAULT 0,
    "is_ban" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("telegram_id")
);

-- CreateTable
CREATE TABLE "account" (
    "account_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pass_imap" TEXT NOT NULL,
    "pass_email" TEXT NOT NULL,
    "cookie" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_oken" TEXT NOT NULL,
    "x_user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "installation_id" TEXT NOT NULL,
    "google_id" TEXT NOT NULL,
    "push_token" TEXT NOT NULL,
    "expires_in" TIMESTAMP(3) NOT NULL,
    "is_access_mp" BOOLEAN NOT NULL DEFAULT true,
    "is_access_cookie" BOOLEAN NOT NULL DEFAULT true,
    "is_only_access_order" BOOLEAN NOT NULL DEFAULT false,
    "bonus_count" INTEGER NOT NULL,
    "is_update_bonus" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "userOwnerId" TEXT,

    CONSTRAINT "account_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "city_sm" (
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,

    CONSTRAINT "city_sm_pkey" PRIMARY KEY ("cityId")
);

-- CreateTable
CREATE TABLE "user_city_sm" (
    "city_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "user_city_sm_pkey" PRIMARY KEY ("city_id","user_id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" SERIAL NOT NULL,
    "order_number" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_telegram_id_key" ON "user"("telegram_id");

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userOwnerId_fkey" FOREIGN KEY ("userOwnerId") REFERENCES "user"("telegram_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_city_sm" ADD CONSTRAINT "user_city_sm_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("telegram_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_city_sm" ADD CONSTRAINT "user_city_sm_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "city_sm"("cityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;
