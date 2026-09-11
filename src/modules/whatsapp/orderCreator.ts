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
      // Obtener un usuario por defecto para WhatsApp
      const user = await prisma.user.findFirst({
        where: { companyId },
      });

      if (!user) {
        throw new Error("No hay usuario en la compañía");
      }

      const ticketNumber = `TKT${Date.now()}`;
      
      const newOrder = await prisma.order.create({
        data: {
          branchId,
          companyId,
          userId: user.id,
          localId: ticketNumber,
          status: "PENDING",
          subtotal: 100,
          discount: 0,
          tax: 16,
          total: 116,
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

  async _generateTicketNumber(companyId: string): Promise<string> {
    return `TKT${Date.now()}`;
  },
};
