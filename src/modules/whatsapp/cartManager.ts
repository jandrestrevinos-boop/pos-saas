/**
 * cartManager.ts
 * Gestiona carrito de compras para WhatsApp
 */

import { prisma } from "@/lib/prisma";

interface CartItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  modifiers?: Array<{ name: string; value: string }>;
  notes?: string;
}

export const cartManager = {
  async addItem(cartId: string, item: CartItem) {
    try {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new Error(`Producto ${item.productId} no existe`);
      }

      // Solo se valida stock si el producto realmente controla inventario.
      if (product.tracksInventory && product.stock < item.quantity) {
        throw new Error(`Stock insuficiente`);
      }

      return await prisma.whatsAppCartItem.create({
        data: {
          cartId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.unitPrice * item.quantity,
          modifiers: item.modifiers || [],
          notes: item.notes || "",
        },
      });
    } catch (error) {
      console.error(`[CartManager] Error:`, error);
      throw error;
    }
  },

  async updateItemQuantity(cartItemId: string, quantity: number) {
    try {
      const cartItem = await prisma.whatsAppCartItem.findUnique({
        where: { id: cartItemId },
      });

      if (!cartItem) {
        throw new Error(`Item no existe`);
      }

      return await prisma.whatsAppCartItem.update({
        where: { id: cartItemId },
        data: {
          quantity,
          lineTotal: cartItem.unitPrice * quantity,
        },
      });
    } catch (error) {
      console.error(`[CartManager] Error:`, error);
      throw error;
    }
  },

  async removeItem(cartItemId: string) {
    try {
      await prisma.whatsAppCartItem.delete({
        where: { id: cartItemId },
      });
      return true;
    } catch (error) {
      console.error(`[CartManager] Error:`, error);
      throw error;
    }
  },

  /**
   * IMPORTANTE: no se suma ningún impuesto extra aquí. El resto del
   * sistema (salesService.create, ventas normales del POS) trata el
   * precio de cada producto como el precio FINAL que paga el cliente
   * (tax: 0 siempre) — así están cargados los precios en /products hoy.
   * Antes este método sumaba un 16% adicional que nadie pidió, así que
   * un pedido de WhatsApp cobraba 16% más que el mismo pedido hecho en
   * el mostrador para los mismos productos. Si algún día se necesita
   * IVA desglosado de verdad, debe activarse aquí Y en salesService.create
   * a la vez, nunca solo en uno de los dos.
   */
  async updateTotals(cartId: string) {
    try {
      const items = await prisma.whatsAppCartItem.findMany({
        where: { cartId },
      });

      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

      return await prisma.whatsAppCart.update({
        where: { id: cartId },
        data: {
          subtotal,
          tax: 0,
          total: subtotal,
        },
      });
    } catch (error) {
      console.error(`[CartManager] Error:`, error);
      throw error;
    }
  },

  async clearCart(cartId: string) {
    try {
      await prisma.whatsAppCartItem.deleteMany({
        where: { cartId },
      });

      await prisma.whatsAppCart.update({
        where: { id: cartId },
        data: {
          subtotal: 0,
          tax: 0,
          discount: 0,
          total: 0,
        },
      });

      return true;
    } catch (error) {
      console.error(`[CartManager] Error:`, error);
      throw error;
    }
  },

  async applyDiscount(cartId: string, discountAmount: number) {
    try {
      const cart = await prisma.whatsAppCart.findUnique({
        where: { id: cartId },
      });

      if (!cart) {
        throw new Error(`Carrito no existe`);
      }

      if (discountAmount > cart.subtotal) {
        throw new Error(`Descuento no puede ser mayor que subtotal`);
      }

      const newSubtotal = cart.subtotal - discountAmount;

      return await prisma.whatsAppCart.update({
        where: { id: cartId },
        data: {
          discount: discountAmount,
          subtotal: newSubtotal,
          tax: 0,
          total: newSubtotal,
        },
      });
    } catch (error) {
      console.error(`[CartManager] Error:`, error);
      throw error;
    }
  },
};
