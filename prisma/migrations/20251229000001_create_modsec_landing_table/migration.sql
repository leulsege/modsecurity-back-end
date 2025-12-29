-- CreateTable
CREATE TABLE "modsec_landing" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tag" TEXT,
    "time" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,
    "processed" BOOLEAN DEFAULT false,

    CONSTRAINT "modsec_landing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "modsec_landing_processed_idx" ON "modsec_landing"("processed");

-- CreateIndex
CREATE INDEX "modsec_landing_time_idx" ON "modsec_landing"("time");

-- CreateIndex
CREATE INDEX "modsec_landing_tag_idx" ON "modsec_landing"("tag");

