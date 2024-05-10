-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('User', 'Admin');

-- AlterTable
ALTER TABLE "user_telegram" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'User';
