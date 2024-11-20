/*
  Warnings:

  - You are about to drop the column `next_view_at` on the `account_lesson_progress` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `lesson` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `original_course` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "account_course" ALTER COLUMN "status" SET DEFAULT 'BLOCKED';

-- AlterTable
ALTER TABLE "account_lesson_progress" DROP COLUMN "next_view_at",
ADD COLUMN     "nextViewAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'BLOCKED';

-- AlterTable
ALTER TABLE "lesson" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "original_course" DROP COLUMN "status";
