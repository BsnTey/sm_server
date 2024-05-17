

-- RenameColumn
ALTER TABLE "account" RENAME COLUMN "expires_in" TO "expires_in_access";

-- AddColumn
ALTER TABLE "account" ADD COLUMN "expires_in_refresh" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;


