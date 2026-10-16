-- AlterTable
ALTER TABLE "companies" ADD COLUMN "requireOpenCashDay" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "cash_registers" ADD COLUMN "folio" INTEGER,
ADD COLUMN "zReport" JSONB,
ADD COLUMN "autoOpened" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "cash_registers_branchId_folio_key" ON "cash_registers"("branchId", "folio");
