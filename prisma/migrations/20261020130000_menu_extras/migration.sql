-- AlterTable
ALTER TABLE "menu_groups" ADD COLUMN     "isExtra" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "order_item_menu_choices" ADD COLUMN     "isExtra" BOOLEAN NOT NULL DEFAULT false;

-- Las elecciones ya vendidas con cargo extra se marcan como extra.
UPDATE "order_item_menu_choices" SET "isExtra" = true WHERE "extraPriceAtSale" > 0;
