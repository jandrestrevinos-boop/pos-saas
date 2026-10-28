-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "tip" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "cardProvider" TEXT;
