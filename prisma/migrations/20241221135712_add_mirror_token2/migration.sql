/*
  Warnings:

  - A unique constraint covering the columns `[mirror_token]` on the table `account_mirror` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "account_mirror_mirror_token_key" ON "account_mirror"("mirror_token");
