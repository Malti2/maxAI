-- AlterTable: per-user iMessage-style sound effects toggle (on by default)
ALTER TABLE "User" ADD COLUMN "soundEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: mark a message as edited once the user edits & resends it
ALTER TABLE "Message" ADD COLUMN "edited" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: refresh the default avatar colour to the new brand blue
ALTER TABLE "User" ALTER COLUMN "avatarColor" SET DEFAULT '#0a84ff';

-- CreateIndex: speed up the per-conversation message load (ordered by time)
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex: speed up the sidebar conversation list (per user, most recent first)
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");
