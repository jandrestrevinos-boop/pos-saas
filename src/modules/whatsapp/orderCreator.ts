import { prisma } from "@/lib/prisma";

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

      if (!cart || cart.items.length === 0) {
        throw new Error("El carrito está vacío, no se puede crear la orden");
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

      const ticketNumber = `TKT${Date.now()}`;

      const newOrder = await prisma.order.create({
        data: {
          branchId,
          companyId,
          userId: user.id,
          localId: ticketNumber,
          status: "PENDING",
          orderType: "PARA_LLEVAR",
          // Totales reales del carrito — ya vienen calculados por
          // cartManager.updateTotals(), no se inventan aquí.
          subtotal: cart.subtotal,
          discount: cart.discount,
          tax: cart.tax,
          total: cart.total,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPriceAtSale: item.unitPrice,
              lineTotal: item.lineTotal,
            })),
          },
        },
      });

      return {
        id: newOrder.id,
        ticketNumber: newOrder.localId,
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
