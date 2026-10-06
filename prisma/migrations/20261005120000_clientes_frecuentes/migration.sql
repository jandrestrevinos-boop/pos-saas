-- CreateEnum
CREATE TYPE "LoyaltyDiscountType" AS ENUM ('PERCENT', 'FIXED');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "cardToken" TEXT,
ADD COLUMN     "lastVisitAt" TIMESTAMP(3),
ADD COLUMN     "loyaltyJoinedAt" TIMESTAMP(3),
ADD COLUMN     "shortCode" TEXT,
ADD COLUMN     "visitsInCycle" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "loyalty_programs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "visitsRequired" INTEGER NOT NULL DEFAULT 7,
    "discountType" "LoyaltyDiscountType" NOT NULL DEFAULT 'PERCENT',
    "discountValue" DECIMAL(10,2) NOT NULL DEFAULT 10,
    "oneVisitPerDay" BOOLEAN NOT NULL DEFAULT true,
    "signupToken" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_visits" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_redemptions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "orderId" TEXT,
    "discountType" "LoyaltyDiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "visitsUsed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_programs_companyId_key" ON "loyalty_programs"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_programs_signupToken_key" ON "loyalty_programs"("signupToken");

-- CreateIndex
CREATE INDEX "loyalty_visits_companyId_createdAt_idx" ON "loyalty_visits"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "loyalty_visits_customerId_createdAt_idx" ON "loyalty_visits"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "loyalty_redemptions_companyId_createdAt_idx" ON "loyalty_redemptions"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "loyalty_redemptions_customerId_idx" ON "loyalty_redemptions"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_cardToken_key" ON "customers"("cardToken");

-- CreateIndex
CREATE UNIQUE INDEX "customers_companyId_shortCode_key" ON "customers"("companyId", "shortCode");

-- AddForeignKey
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_visits" ADD CONSTRAINT "loyalty_visits_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_visits" ADD CONSTRAINT "loyalty_visits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
