import { prisma } from "@/lib/prisma";
import { promotionsService } from "@/modules/promotions/service";

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
  const products = await prisma.product.findMany({
    where: { companyId, id: { in: [...new Set(cart.items.map((i) => i.productId))] } },
    select: { id: true, categoryId: true },
  });
  const categoryOf = new Map(products.map((p) => [p.id, p.categoryId]));

  const subtotal = cart.items.reduce((sum, i) => sum + i.lineTotal, 0);
  const promo = await promotionsService.evaluateForSale(
    companyId,
    cart.items.map((i) => ({
      productId: i.productId,
      categoryId: categoryOf.get(i.productId) ?? "",
      unitPrice: i.unitPrice,
      quantity: i.quantity,
    }))
  );
  return { subtotal, promo };
}
