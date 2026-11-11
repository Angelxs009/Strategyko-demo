-- CreateTable
CREATE TABLE "RateQuery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'dev-tenant',
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "container" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateQuoteRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'dev-tenant',
    "queryId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "container" TEXT NOT NULL,
    "baseFreightUsd" DECIMAL(12,2) NOT NULL,
    "totalUsd" DECIMAL(12,2) NOT NULL,
    "transitDays" INTEGER NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateQuoteRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurchargeRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'dev-tenant',
    "quoteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountUsd" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "SurchargeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateQuery_tenantId_createdAt_idx" ON "RateQuery"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "RateQuoteRecord_tenantId_origin_destination_container_fetch_idx" ON "RateQuoteRecord"("tenantId", "origin", "destination", "container", "fetchedAt");

-- CreateIndex
CREATE INDEX "RateQuoteRecord_tenantId_carrier_idx" ON "RateQuoteRecord"("tenantId", "carrier");

-- CreateIndex
CREATE INDEX "SurchargeRecord_quoteId_idx" ON "SurchargeRecord"("quoteId");

-- AddForeignKey
ALTER TABLE "RateQuoteRecord" ADD CONSTRAINT "RateQuoteRecord_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "RateQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurchargeRecord" ADD CONSTRAINT "SurchargeRecord_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "RateQuoteRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
