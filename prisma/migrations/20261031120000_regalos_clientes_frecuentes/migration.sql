-- AlterEnum
ALTER TYPE "LoyaltyDiscountType" ADD VALUE 'GIFT';

-- AlterTable
ALTER TABLE "loyalty_redemptions" ADD COLUMN     "giftId" TEXT,
ADD COLUMN     "giftName" TEXT;

-- CreateTable
CREATE TABLE "loyalty_gifts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "productId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_gifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loyalty_gifts_companyId_idx" ON "loyalty_gifts"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_gifts_companyId_productId_key" ON "loyalty_gifts"("companyId", "productId");

-- AddForeignKey
ALTER TABLE "loyalty_gifts" ADD CONSTRAINT "loyalty_gifts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_gifts" ADD CONSTRAINT "loyalty_gifts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
