-- CreateEnum
CREATE TYPE "HardwareFinancingStatus" AS ENUM ('PENDING', 'ACTIVE', 'PARTIALLY_PAID', 'OVERDUE', 'LIQUIDATED', 'CANCELLED', 'RESTRUCTURED');

-- CreateEnum
CREATE TYPE "HardwareFinancingPeriodicity" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "HardwarePaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- AlterEnum
ALTER TYPE "CompanyStatus" ADD VALUE 'CANCELLED';

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL,
    "blockCancellationWithPendingFinancing" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hardware_financings" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "HardwareFinancingStatus" NOT NULL DEFAULT 'PENDING',
    "periodicity" "HardwareFinancingPeriodicity" NOT NULL DEFAULT 'MONTHLY',
    "hardwareListValue" DECIMAL(12,2) NOT NULL,
    "negotiatedValue" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "downPayment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "financialCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "interestRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "financedBalance" DECIMAL(12,2) NOT NULL,
    "totalInstallments" INTEGER NOT NULL,
    "installmentAmount" DECIMAL(12,2) NOT NULL,
    "firstPaymentDueDate" TIMESTAMP(3) NOT NULL,
    "finalPaymentDueDate" TIMESTAMP(3),
    "paymentsCompleted" INTEGER NOT NULL DEFAULT 0,
    "remainingBalance" DECIMAL(12,2) NOT NULL,
    "liquidatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "restructuredFromId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hardware_financings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hardware_financing_items" (
    "id" TEXT NOT NULL,
    "financingId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "catalogUnitPrice" DECIMAL(12,2) NOT NULL,
    "negotiatedUnitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hardware_financing_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hardware_financing_payments" (
    "id" TEXT NOT NULL,
    "financingId" TEXT NOT NULL,
    "paymentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "HardwarePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "mercadoPagoPaymentId" TEXT,
    "externalReference" TEXT NOT NULL,
    "webhookEventId" TEXT,
    "paymentMethodNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hardware_financing_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hardware_financings_code_key" ON "hardware_financings"("code");

-- CreateIndex
CREATE INDEX "hardware_financings_companyId_status_idx" ON "hardware_financings"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "hardware_financing_payments_mercadoPagoPaymentId_key" ON "hardware_financing_payments"("mercadoPagoPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "hardware_financing_payments_externalReference_key" ON "hardware_financing_payments"("externalReference");

-- CreateIndex
CREATE INDEX "hardware_financing_payments_status_dueDate_idx" ON "hardware_financing_payments"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "hardware_financing_payments_financingId_paymentNumber_key" ON "hardware_financing_payments"("financingId", "paymentNumber");

-- AddForeignKey
ALTER TABLE "hardware_financings" ADD CONSTRAINT "hardware_financings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_financings" ADD CONSTRAINT "hardware_financings_restructuredFromId_fkey" FOREIGN KEY ("restructuredFromId") REFERENCES "hardware_financings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_financings" ADD CONSTRAINT "hardware_financings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_financing_items" ADD CONSTRAINT "hardware_financing_items_financingId_fkey" FOREIGN KEY ("financingId") REFERENCES "hardware_financings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_financing_items" ADD CONSTRAINT "hardware_financing_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_financing_payments" ADD CONSTRAINT "hardware_financing_payments_financingId_fkey" FOREIGN KEY ("financingId") REFERENCES "hardware_financings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
