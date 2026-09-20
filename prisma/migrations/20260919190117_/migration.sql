/*
  Warnings:

  - A unique constraint covering the columns `[mpPointOrderId]` on the table `payments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'MERCADOPAGO_TERMINAL';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "mpPointOrderId" TEXT;

-- CreateTable
CREATE TABLE "mercadopago_terminals" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "posId" INTEGER,
    "storeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mercadopago_terminals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mercadopago_terminals_branchId_key" ON "mercadopago_terminals"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_mpPointOrderId_key" ON "payments"("mpPointOrderId");

-- AddForeignKey
ALTER TABLE "mercadopago_terminals" ADD CONSTRAINT "mercadopago_terminals_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
