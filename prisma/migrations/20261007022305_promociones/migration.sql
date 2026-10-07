-- CreateEnum
CREATE TYPE "PromotionKind" AS ENUM ('PERCENT_OFF', 'AMOUNT_OFF', 'BUY_X_PAY_Y');

-- CreateEnum
CREATE TYPE "PromotionScope" AS ENUM ('PRODUCTS', 'CATEGORIES', 'TICKET');

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PromotionKind" NOT NULL,
    "scope" "PromotionScope" NOT NULL,
    "value" DECIMAL(10,2),
    "buyQty" INTEGER,
    "payQty" INTEGER,
    "minSubtotal" DECIMAL(10,2),
    "productIds" JSONB,
    "categoryIds" JSONB,
    "couponCode" TEXT,
    "maxUses" INTEGER,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "weekdays" JSONB,
    "startTime" TEXT,
    "endTime" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_promotions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "promotionId" TEXT,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotions_companyId_idx" ON "promotions"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_companyId_couponCode_key" ON "promotions"("companyId", "couponCode");

-- CreateIndex
CREATE INDEX "order_promotions_orderId_idx" ON "order_promotions"("orderId");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_promotions" ADD CONSTRAINT "order_promotions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_promotions" ADD CONSTRAINT "order_promotions_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
