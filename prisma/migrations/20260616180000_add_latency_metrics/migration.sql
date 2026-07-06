-- ApiLatencyMetric table for real-time infrastructure latency tracking
CREATE TABLE "api_latency_metrics" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "probeRegion" TEXT,
    "requestedModel" TEXT,
    "returnedModel" TEXT,
    "authMs" DOUBLE PRECISION,
    "quotaMs" DOUBLE PRECISION,
    "routingMs" DOUBLE PRECISION,
    "preVendorMs" DOUBLE PRECISION,
    "vendorHeadersMs" DOUBLE PRECISION,
    "vendorFirstByteMs" DOUBLE PRECISION,
    "vendorFirstTokenMs" DOUBLE PRECISION,
    "vendorTotalMs" DOUBLE PRECISION,
    "opusxFirstTokenMs" DOUBLE PRECISION,
    "opusxTotalMs" DOUBLE PRECISION,
    "firstTokenOverheadMs" DOUBLE PRECISION,
    "postVendorFirstTokenOverheadMs" DOUBLE PRECISION,
    "streamCompletionOverheadMs" DOUBLE PRECISION,
    "statusCode" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorType" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_latency_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_latency_metrics_requestId_key" ON "api_latency_metrics"("requestId");
CREATE INDEX "api_latency_metrics_sourceType_createdAt_idx" ON "api_latency_metrics"("sourceType", "createdAt");
CREATE INDEX "api_latency_metrics_success_createdAt_idx" ON "api_latency_metrics"("success", "createdAt");
CREATE INDEX "api_latency_metrics_requestedModel_createdAt_idx" ON "api_latency_metrics"("requestedModel", "createdAt");
CREATE INDEX "api_latency_metrics_createdAt_idx" ON "api_latency_metrics"("createdAt");
