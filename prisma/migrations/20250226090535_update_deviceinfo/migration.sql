-- CreateTable
CREATE TABLE "device_info" (
    "id" UUID NOT NULL,
    "os_version" TEXT NOT NULL,
    "build_version" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "screen_resolution" TEXT NOT NULL,
    "browser_version" TEXT NOT NULL,
    "IP" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_info_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_info_account_id_key" ON "device_info"("account_id");

-- AddForeignKey
ALTER TABLE "device_info" ADD CONSTRAINT "device_info_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;
