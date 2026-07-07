-- Add messagesPath column so each provider can have its own API endpoint path
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "messagesPath" TEXT DEFAULT '/v1/messages';
