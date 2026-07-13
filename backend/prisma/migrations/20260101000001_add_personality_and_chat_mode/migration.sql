-- AlterTable
ALTER TABLE "User" ADD COLUMN "personality" TEXT NOT NULL DEFAULT 'assistant';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "chatMode" BOOLEAN NOT NULL DEFAULT false;
