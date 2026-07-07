-- Add format column: 'anthropic' (default) or 'openai' for OpenAI-compatible providers
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "format" TEXT DEFAULT 'anthropic';
-- Add modelOverride column: maps incoming model to provider-specific model name
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "modelOverride" TEXT;
