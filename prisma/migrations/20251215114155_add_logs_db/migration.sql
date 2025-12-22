-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "action" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "clientIp" TEXT NOT NULL,
    "clientPort" INTEGER,
    "host" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "requestUrl" TEXT NOT NULL,
    "rule" TEXT,
    "ruleId" TEXT,
    "userAgent" TEXT,
    "headers" JSONB,
    "message" TEXT,
    "httpMethod" TEXT,
    "responseHeader" JSONB,
    "responseCode" INTEGER,
    "maturity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Log_organizationId_idx" ON "Log"("organizationId");

-- CreateIndex
CREATE INDEX "Log_timestamp_idx" ON "Log"("timestamp");

-- CreateIndex
CREATE INDEX "Log_clientIp_idx" ON "Log"("clientIp");

-- CreateIndex
CREATE INDEX "Log_action_idx" ON "Log"("action");

-- CreateIndex
CREATE INDEX "Log_severity_idx" ON "Log"("severity");

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
