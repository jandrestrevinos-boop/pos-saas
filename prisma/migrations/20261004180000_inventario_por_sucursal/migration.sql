-- CreateTable
CREATE TABLE "branch_stocks" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branch_stocks_branchId_idx" ON "branch_stocks"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "branch_stocks_productId_branchId_key" ON "branch_stocks"("productId", "branchId");

-- CreateIndex
CREATE INDEX "stock_transfers_companyId_createdAt_idx" ON "stock_transfers"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "branch_stocks" ADD CONSTRAINT "branch_stocks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_stocks" ADD CONSTRAINT "branch_stocks_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Respaldo de lo que ya tienes: la existencia actual de cada producto que controla
-- inventario se queda en la sucursal MÁS ANTIGUA de su empresa; las demás sucursales
-- empiezan en 0 (ahí se reparte con una transferencia o una entrada de mercancía).
-- Product.stock no se toca: sigue siendo el total.
INSERT INTO "branch_stocks" ("id", "productId", "branchId", "stock", "updatedAt")
SELECT
    gen_random_uuid()::text,
    p."id",
    b."id",
    CASE
        WHEN b."id" = (
            SELECT b2."id" FROM "branches" b2
            WHERE b2."companyId" = p."companyId"
            ORDER BY b2."createdAt" ASC, b2."id" ASC
            LIMIT 1
        ) THEN p."stock"
        ELSE 0
    END,
    CURRENT_TIMESTAMP
FROM "products" p
JOIN "branches" b ON b."companyId" = p."companyId"
WHERE p."tracksInventory" = true;
