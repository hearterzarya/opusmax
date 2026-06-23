-- Add fixed-window anchor for the 5-hour token quota.
-- When NULL, the next request opens a fresh window; resetAt = quotaWindowStartAt + 5h (fixed).
ALTER TABLE "api_keys" ADD COLUMN "quotaWindowStartAt" TIMESTAMP(3);
