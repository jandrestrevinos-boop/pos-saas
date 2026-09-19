/*
  Warnings:

  - A unique constraint covering the columns `[mpPaymentId]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[currentOrderId]` on the table `tables` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('COMER_AQUI', 'PARA_LLEVAR', 'DOMICILIO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'MERCADOPAGO';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "isOpenTab" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "orderType" "OrderType" NOT NULL DEFAULT 'COMER_AQUI';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "mpPaymentId" TEXT,
ADD COLUMN     "mpPreferenceId" TEXT,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE "tables" ADD COLUMN     "currentOrderId" TEXT;

-- CreateTable
CREATE TABLE "mercadopago_accounts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "mpUserId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "publicKey" TEXT,
    "liveMode" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mercadopago_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mercadopago_accounts_companyId_key" ON "mercadopago_accounts"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_mpPaymentId_key" ON "payments"("mpPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "tables_currentOrderId_key" ON "tables"("currentOrderId");

-- AddForeignKey
ALTER TABLE "mercadopago_accounts" ADD CONSTRAINT "mercadopago_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_currentOrderId_fkey" FOREIGN KEY ("currentOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
