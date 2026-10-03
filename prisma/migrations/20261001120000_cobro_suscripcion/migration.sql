-- CreateEnum
CREATE TYPE "SubscriptionPaymentMethod" AS ENUM ('MERCADOPAGO', 'MANUAL');

-- CreateEnum
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "hardwareFinancingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "defaultTrialDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "graceDays" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "mpPreapprovalId" TEXT,
ADD COLUMN     "payerEmail" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amountMxn" DECIMAL(10,2) NOT NULL,
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" "SubscriptionPaymentMethod" NOT NULL DEFAULT 'MERCADOPAGO',
    "mpPaymentId" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payments_mpPaymentId_key" ON "subscription_payments"("mpPaymentId");

-- CreateIndex
CREATE INDEX "subscription_payments_companyId_createdAt_idx" ON "subscription_payments"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_mpPreapprovalId_key" ON "subscriptions"("mpPreapprovalId");

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: las empresas que ya tienen un financiamiento de hardware conservan
-- la capacidad (el interruptor nuevo nace apagado para el resto).
UPDATE "companies" SET "hardwareFinancingEnabled" = true
WHERE "id" IN (SELECT DISTINCT "companyId" FROM "hardware_financings");
