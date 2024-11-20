-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('NONE', 'ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('NONE', 'VIEWED', 'BLOCKED');

-- AlterTable
ALTER TABLE "account" ADD COLUMN     "access_token_course" TEXT,
ADD COLUMN     "is_valid_access_token_course" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "refresh_token_course" TEXT;

-- CreateTable
CREATE TABLE "original_course" (
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mnemocode" TEXT NOT NULL,
    "status" "CourseStatus" NOT NULL DEFAULT 'NONE',
    "points" INTEGER NOT NULL,
    "accountAccountId" TEXT,

    CONSTRAINT "original_course_pkey" PRIMARY KEY ("course_id")
);

-- CreateTable
CREATE TABLE "account_course" (
    "account_course_id" SERIAL NOT NULL,
    "account_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "status" "CourseStatus" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "account_course_pkey" PRIMARY KEY ("account_course_id")
);

-- CreateTable
CREATE TABLE "lesson" (
    "lesson_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'BLOCKED',
    "video_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,

    CONSTRAINT "lesson_pkey" PRIMARY KEY ("lesson_id")
);

-- CreateTable
CREATE TABLE "account_lesson_progress" (
    "progress_id" SERIAL NOT NULL,
    "account_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'NONE',
    "next_view_at" TIMESTAMP(3) NOT NULL,
    "accountCourseAccountCourseId" INTEGER,

    CONSTRAINT "account_lesson_progress_pkey" PRIMARY KEY ("progress_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_course_account_id_course_id_key" ON "account_course"("account_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_course_id_position_key" ON "lesson"("course_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "account_lesson_progress_account_id_lesson_id_key" ON "account_lesson_progress"("account_id", "lesson_id");

-- AddForeignKey
ALTER TABLE "original_course" ADD CONSTRAINT "original_course_accountAccountId_fkey" FOREIGN KEY ("accountAccountId") REFERENCES "account"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_course" ADD CONSTRAINT "account_course_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_course" ADD CONSTRAINT "account_course_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "original_course"("course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "original_course"("course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_lesson_progress" ADD CONSTRAINT "account_lesson_progress_accountCourseAccountCourseId_fkey" FOREIGN KEY ("accountCourseAccountCourseId") REFERENCES "account_course"("account_course_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_lesson_progress" ADD CONSTRAINT "account_lesson_progress_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_lesson_progress" ADD CONSTRAINT "account_lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lesson"("lesson_id") ON DELETE RESTRICT ON UPDATE CASCADE;
