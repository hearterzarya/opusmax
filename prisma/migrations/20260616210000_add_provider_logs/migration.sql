CREATE TABLE "provider_logs" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "apiKeyName" TEXT,
    "model" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusCode" INTEGER,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "provider_logs_createdAt_idx" ON "provider_logs"("createdAt");
CREATE INDEX "provider_logs_providerName_createdAt_idx" ON "provider_logs"("providerName", "createdAt");
CREATE INDEX "provider_logs_apiKeyId_createdAt_idx" ON "provider_logs"("apiKeyId", "createdAt");
CREATE INDEX "provider_logs_status_createdAt_idx" ON "provider_logs"("status", "createdAt");
