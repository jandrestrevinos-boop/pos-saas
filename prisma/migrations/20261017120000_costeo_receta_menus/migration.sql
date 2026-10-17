-- AlterTable
ALTER TABLE "products" ADD COLUMN     "isMenu" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "extraCostAtSale" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "costPerUnit" DECIMAL(12,4) NOT NULL,
    "wastePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_items" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_groups" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSelect" INTEGER NOT NULL DEFAULT 1,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_options" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "optionProductId" TEXT NOT NULL,
    "extraPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "menu_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_menu_choices" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "optionProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "extraPriceAtSale" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "costAtSale" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "order_item_menu_choices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_companyId_name_key" ON "ingredients"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_items_productId_ingredientId_key" ON "recipe_items"("productId", "ingredientId");

-- CreateIndex
CREATE INDEX "menu_groups_productId_idx" ON "menu_groups"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "menu_options_groupId_optionProductId_key" ON "menu_options"("groupId", "optionProductId");

-- CreateIndex
CREATE INDEX "order_item_menu_choices_orderItemId_idx" ON "order_item_menu_choices"("orderItemId");

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_groups" ADD CONSTRAINT "menu_groups_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_options" ADD CONSTRAINT "menu_options_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "menu_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_options" ADD CONSTRAINT "menu_options_optionProductId_fkey" FOREIGN KEY ("optionProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_menu_choices" ADD CONSTRAINT "order_item_menu_choices_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
