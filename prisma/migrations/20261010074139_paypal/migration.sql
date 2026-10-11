/*
  Warnings:

  - A unique constraint covering the columns `[paypalPaymentId]` on the table `subscription_payments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[paypalSubscriptionId]` on the table `subscriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "SubscriptionPaymentMethod" ADD VALUE 'PAYPAL';

-- AlterTable
ALTER TABLE "subscription_payments" ADD COLUMN     "paypalPaymentId" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "paypalSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payments_paypalPaymentId_key" ON "subscription_payments"("paypalPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_paypalSubscriptionId_key" ON "subscriptions"("paypalSubscriptionId");
