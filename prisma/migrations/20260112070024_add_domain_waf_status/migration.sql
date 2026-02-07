-- CreateTable
CREATE TABLE "DomainWAFStatus" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "wafEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainWAFStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DomainWAFStatus_organizationId_idx" ON "DomainWAFStatus"("organizationId");

-- CreateIndex
CREATE INDEX "DomainWAFStatus_domain_idx" ON "DomainWAFStatus"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "DomainWAFStatus_organizationId_domain_key" ON "DomainWAFStatus"("organizationId", "domain");

-- AddForeignKey
ALTER TABLE "DomainWAFStatus" ADD CONSTRAINT "DomainWAFStatus_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
