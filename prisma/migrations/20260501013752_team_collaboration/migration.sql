-- Team collaboration: AppAccount, AccountMember, Invite + backfill existing forms

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('VIEWER', 'EDITOR');

-- CreateTable: app_accounts
CREATE TABLE "app_accounts" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: account_members
CREATE TABLE "account_members" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable: invites
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "app_accounts_ownerId_key" ON "app_accounts"("ownerId");
CREATE UNIQUE INDEX "account_members_accountId_userId_key" ON "account_members"("accountId", "userId");
CREATE INDEX "account_members_userId_idx" ON "account_members"("userId");
CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");
CREATE INDEX "invites_email_idx" ON "invites"("email");
CREATE UNIQUE INDEX "invites_accountId_email_key" ON "invites"("accountId", "email");

-- AddForeignKeys (app_accounts -> users, account_members -> app_accounts/users, invites -> app_accounts)
ALTER TABLE "app_accounts" ADD CONSTRAINT "app_accounts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invites" ADD CONSTRAINT "invites_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add accountId to forms (nullable for backfill)
ALTER TABLE "forms" ADD COLUMN "accountId" TEXT;

-- Backfill: one AppAccount per existing User
INSERT INTO "app_accounts" ("id", "ownerId", "name", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  u."id",
  COALESCE(NULLIF(u."name", ''), u."email") || '''s account',
  NOW(),
  NOW()
FROM "users" u
WHERE NOT EXISTS (SELECT 1 FROM "app_accounts" a WHERE a."ownerId" = u."id");

-- Backfill: forms.accountId = the account owned by forms.userId
UPDATE "forms" f
SET "accountId" = a."id"
FROM "app_accounts" a
WHERE a."ownerId" = f."userId" AND f."accountId" IS NULL;

-- Now make accountId NOT NULL
ALTER TABLE "forms" ALTER COLUMN "accountId" SET NOT NULL;

-- Index + FK on forms.accountId
CREATE INDEX "forms_accountId_idx" ON "forms"("accountId");
ALTER TABLE "forms" ADD CONSTRAINT "forms_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
