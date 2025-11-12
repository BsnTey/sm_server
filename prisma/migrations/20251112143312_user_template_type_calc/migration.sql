-- CreateEnum
CREATE TYPE "TypeCalculate" AS ENUM ('Bonus', 'Promocode', 'MyDiscount');

-- AlterTable
ALTER TABLE "user_template" ADD COLUMN     "calculate_type" "TypeCalculate" NOT NULL DEFAULT 'Promocode';
