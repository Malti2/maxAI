-- Web search preferences and generation settings, per user.
ALTER TABLE "User" ADD COLUMN     "webSearch" BOOLEAN NOT NULL DEFAULT false,
                  ADD COLUMN     "webSearchSources" INTEGER NOT NULL DEFAULT 4,
                  ADD COLUMN     "webSearchReadPages" BOOLEAN NOT NULL DEFAULT true,
                  ADD COLUMN     "temperature" DOUBLE PRECISION,
                  ADD COLUMN     "maxTokens" INTEGER,
                  ADD COLUMN     "historyLimit" INTEGER NOT NULL DEFAULT 50,
                  ADD COLUMN     "reasoningEffort" TEXT;

-- Sources cited by an answer that used web search.
ALTER TABLE "Message" ADD COLUMN "sources" JSONB;
