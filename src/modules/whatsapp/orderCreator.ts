import { prisma } from "@/lib/prisma";
import { promotionsService } from "@/modules/promotions/service";
import { evaluateCartPromotions } from "./cartPromotions";
import { menusService } from "@/modules/menus/service";
import { choicesOf, isPendingItem } from "./menuState";

interface OrderCreationResult {
  id: string;
  ticketNumber: string;
  total: number;
  status: string;
  createdAt: Date;
}

export const orderCreator = {
  async createOrderFromCart(
    cartId: string,
    companyId: string,
    branchId: string,
    phoneNumber: string
  ): Promise<OrderCreationResult> {
    try {
      const cart = await prisma.whatsAppCart.findUnique({
        where: { id: cartId },
        include: { items: true },
      });

      // Un menú que el cliente nunca terminó de armar no entra al pedido.
      const readyItems = cart ? cart.items.filter((i) => !isPendingItem(i)) : [];
      if (!cart || readyItems.length === 0) {
        throw new Error("El carrito está vacío, no se puede crear la orden");
      }

      // Menús completos: se vuelve a validar lo que eligió el cliente y se congela nombre, cargo y costo de cada opción.
      const menuByItem = new Map<string, Awaited<ReturnType<typeof menusService.resolveChoices>>>();
      for (const item of readyItems) {
        const ids = choicesOf(item.modifiers);
        if (ids.length > 0) menuByItem.set(item.id, await menusService.resolveChoices(companyId, item.productId, ids));
      }

      // Usuario "sistema" para atribuir ventas que entran por WhatsApp
      // (no hay un cajero humano detrás). Usamos el primero de la empresa
      // por ahora — mejora futura: un usuario dedicado tipo "WhatsApp Bot".
      const user = await prisma.user.findFirst({
        where: { companyId },
      });

      if (!user) {
        throw new Error("No hay usuario en la compañía para atribuir la orden");
      }

      // Se recalcula al confirmar: si una promoción venció o empezó mientras el cliente pedía, se cobra lo vigente.
      const { promo } = await evaluateCartPromotions(cartId);

      const newOrder = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          branchId,
          companyId,
          userId: user.id,
          // Identificador interno para soporte offline del POS — NO es el
          // número que ve el cliente ni el staff. Mismo patrón que usa
          // salesService.create para ventas normales del mostrador.
          localId: crypto.randomUUID(),
          status: "PENDING",
          orderType: "PARA_LLEVAR",
          // Totales reales del carrito — ya vienen calculados por
          // cartManager.updateTotals(), no se inventan aquí.
          subtotal: cart.subtotal,
          discount: promo.discount,
          tax: cart.tax,
          total: Math.round((cart.subtotal - promo.discount) * 100) / 100,
          items: {
            create: readyItems.map((item) => {
              const menu = menuByItem.get(item.id);
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPriceAtSale: item.unitPrice,
                lineTotal: item.lineTotal,
                ...(menu
                  ? {
                      extraCostAtSale: menu.extraCost,
                      menuChoices: {
                        create: menu.choices.map((c) => ({
                          optionProductId: c.optionProductId,
                          name: c.name,
                          extraPriceAtSale: c.extraPriceAtSale,
                          costAtSale: c.costAtSale,
                        })),
                      },
                    }
                  : {}),
              };
            }),
          },
        },
      });
      await promotionsService.recordApplications(tx, created.id, promo.applied);
      return created;
      });

      return {
        id: newOrder.id,
        // orderNumber es el consecutivo real que también ve el cocinero
        // en la Pantalla de Cocina y el cajero al cobrar — antes aquí se
        // inventaba un número aparte ("TKT" + hora del servidor) que no
        // coincidía con nada más en el sistema, así que el cliente no
        // podía usarlo para que lo identificaran en el mostrador.
        ticketNumber: String(newOrder.orderNumber),
        total: Number(newOrder.total),
        status: newOrder.status,
        createdAt: newOrder.createdAt,
      };
    } catch (error) {
      console.error("[OrderCreator]", error);
      throw error;
    }
  },
};
