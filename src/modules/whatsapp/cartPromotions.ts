import { prisma } from "@/lib/prisma";
import { promotionsService } from "@/modules/promotions/service";
import { isPendingItem } from "./menuState";

/**
 * Promociones automáticas de un carrito de WhatsApp. Por este canal no se escribe cupón,
 * así que solo aplican las promociones sin código (por producto, categoría, ticket y horario).
 */
export async function evaluateCartPromotions(cartId: string) {
  const cart = await prisma.whatsAppCart.findUnique({
    where: { id: cartId },
    include: { session: { select: { companyId: true } }, items: true },
  });
  if (!cart) throw new Error("Carrito no existe");

  const companyId = cart.session.companyId;
  // Un menú que el cliente todavía está armando no cuenta para promociones ni totales.
  const items = cart.items.filter((i) => !isPendingItem(i));
  const products = await prisma.product.findMany({
    where: { companyId, id: { in: [...new Set(items.map((i) => i.productId))] } },
    select: { id: true, categoryId: true },
  });
  const categoryOf = new Map(products.map((p) => [p.id, p.categoryId]));

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const promo = await promotionsService.evaluateForSale(
    companyId,
    items.map((i) => ({
      productId: i.productId,
      categoryId: categoryOf.get(i.productId) ?? "",
      unitPrice: i.unitPrice,
      quantity: i.quantity,
    }))
  );
  return { subtotal, promo };
}
