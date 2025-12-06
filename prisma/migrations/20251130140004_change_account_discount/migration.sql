-- --- БЛОК РУЧНОЙ ОЧИСТКИ (START) ---

-- 1. Очищаем зависимые таблицы
TRUNCATE TABLE "account_discount_product" CASCADE;
TRUNCATE TABLE "account_discount" CASCADE;
TRUNCATE TABLE "product_info" CASCADE;

-- 2. Если таблица product удаляется скриптом ниже, то TRUNCATE не обязателен,
-- но поможет избежать ошибок внешних ключей при удалении:
TRUNCATE TABLE "product" CASCADE;

-- 3. ВАЖНО: Скрипт ниже пытается создать "node_product".
-- Если она уже есть, скрипт упадет. Удалим её превентивно:
DROP TABLE IF EXISTS "node_product" CASCADE;

-- --- БЛОК РУЧНОЙ ОЧИСТКИ (END) ---


-- DropForeignKey
ALTER TABLE "product_info" DROP CONSTRAINT "product_info_product_id_fkey";

-- AlterTable
ALTER TABLE "account_discount" DROP COLUMN "date_end",
DROP COLUMN "node_name";

-- AlterTable
ALTER TABLE "account_discount_product" DROP COLUMN "date_end",
ADD COLUMN     "node_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "product";

-- CreateTable
CREATE TABLE "node_product" (
    "node_id" TEXT NOT NULL,
    "node_name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "date_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_product_pkey" PRIMARY KEY ("node_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_info_product_id_article_sku_key" ON "product_info"("product_id", "article", "sku");

-- AddForeignKey
ALTER TABLE "account_discount" ADD CONSTRAINT "account_discount_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "node_product"("node_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_discount_product" ADD CONSTRAINT "account_discount_product_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "node_product"("node_id") ON DELETE RESTRICT ON UPDATE CASCADE;
