-- AlterTable
ALTER TABLE "city_sm" ALTER COLUMN "name" SET DEFAULT 'Москва',
ALTER COLUMN "city_id" SET DEFAULT '1720920299',
ALTER COLUMN "full_name" SET DEFAULT 'Москва';

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "city_sm"("city_id") ON DELETE RESTRICT ON UPDATE CASCADE;
