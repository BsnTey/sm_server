/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `course` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[todo]` on the table `todo` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "course_name_key" ON "course"("name");

-- CreateIndex
CREATE UNIQUE INDEX "todo_todo_key" ON "todo"("todo");
