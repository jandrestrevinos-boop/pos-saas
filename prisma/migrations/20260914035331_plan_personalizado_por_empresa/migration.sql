-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "customFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "customPriceMxn" DECIMAL(10,2),
ADD COLUMN     "useCustomPlan" BOOLEAN NOT NULL DEFAULT false;
