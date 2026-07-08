-- Global settings table for admin-configurable overrides
CREATE TABLE IF NOT EXISTS "gateway_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateway_settings_pkey" PRIMARY KEY ("key")
);
