-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "roundNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "order_items_orderId_roundNumber_idx" ON "order_items"("orderId", "roundNumber");

-- CreateIndex
CREATE INDEX "order_items_status_idx" ON "order_items"("status");
