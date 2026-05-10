-- Remove scheduled expiry from all keys. Stale EXPIRED status is cleared on next request
-- when expiresAt is null (see validateApiKey / validateActiveApiKeyFromRequest).
UPDATE "api_keys" SET "expiresAt" = NULL;
