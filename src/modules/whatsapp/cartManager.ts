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

      if (product.stock < item.quantity) {
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

  async updateTotals(cartId: string) {
    try {
      const items = await prisma.whatsAppCartItem.findMany({
        where: { cartId },
      });

      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      const tax = subtotal * 0.16;
      const total = subtotal + tax;

      return await prisma.whatsAppCart.update({
        where: { id: cartId },
        data: {
          subtotal,
          tax,
          total,
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
      const newTax = newSubtotal * 0.16;
      const newTotal = newSubtotal + newTax;

      return await prisma.whatsAppCart.update({
        where: { id: cartId },
        data: {
          discount: discountAmount,
          subtotal: newSubtotal,
          tax: newTax,
          total: newTotal,
        },
      });
    } catch (error) {
      console.error(`[CartManager] Error:`, error);
      throw error;
    }
  },
};
