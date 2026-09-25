/**
 * messageProcessor.ts
 * Orquestra el flujo completo de WhatsApp Orders
 */

import { prisma } from "@/lib/prisma";
import { aiInterpreter } from "./aiInterpreter";
import { catalogService } from "./catalogService";
import { cartManager } from "./cartManager";
import { orderCreator } from "./orderCreator";
import { sender } from "./sender";

interface MessageContext {
  phoneNumber: string;
  companyId: string;
  branchId: string;
  messageText: string;
  messageId: string;
  // Credenciales de ESTA empresa — vienen del WhatsAppConfig resuelto en
  // el webhook, nunca de una variable de entorno global.
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
}

interface ProcessingResult {
  success: boolean;
  response: string;
  action: "browse" | "add_to_cart" | "confirm_order" | "error" | "abandon";
  orderId?: string;
  error?: string;
}

export const messageProcessor = {
  async processMessage(context: MessageContext): Promise<ProcessingResult> {
    try {
      let session = await prisma.whatsAppSession.findFirst({
        where: {
          phoneNumber: context.phoneNumber,
          companyId: context.companyId,
        },
      });

      if (!session) {
        session = await prisma.whatsAppSession.create({
          data: {
            phoneNumber: context.phoneNumber,
            customerId: null,
            companyId: context.companyId,
            state: "BROWSING",
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        });
      }

      if (session.expiresAt < new Date()) {
        const expiredResult: ProcessingResult = {
          success: false,
          response: "Tu sesión expiró. Escribe 'menú' para empezar de nuevo.",
          action: "abandon",
          error: "Session expired",
        };

        await sender.sendMessage({
          phoneNumber: context.phoneNumber,
          message: expiredResult.response,
          whatsappPhoneNumberId: context.whatsappPhoneNumberId,
          whatsappAccessToken: context.whatsappAccessToken,
        });

        await prisma.whatsAppSession.update({
          where: { id: session.id },
          data: {
            state: "BROWSING",
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        });

        return expiredResult;
      }

      const aiResult = await aiInterpreter.interpret({
        messageText: context.messageText,
        companyId: context.companyId,
        branchId: context.branchId,
        sessionState: session.state,
      });

      if (!aiResult.success) {
        await sender.sendMessage({
          phoneNumber: context.phoneNumber,
          message: aiResult.fallbackResponse,
          whatsappPhoneNumberId: context.whatsappPhoneNumberId,
          whatsappAccessToken: context.whatsappAccessToken,
        });

        return {
          success: false,
          response: aiResult.fallbackResponse,
          action: "error",
          error: aiResult.error,
        };
      }

      await prisma.whatsAppConversation.create({
        data: {
          sessionId: session.id,
          direction: "INCOMING",
          content: context.messageText,
          messageId: context.messageId,
        },
      });

      let result: ProcessingResult;

      switch (aiResult.intent) {
        case "BROWSE_MENU":
          result = await this._handleBrowseMenu(session.id, context.companyId, context.branchId);
          break;
        case "ADD_PRODUCT":
          result = await this._handleAddProduct(
            session.id,
            context.companyId,
            context.branchId,
            aiResult.products || [],
            aiResult.modifiers || []
          );
          break;
        case "MODIFY_CART":
          result = await this._handleModifyCart(session.id, context.companyId);
          break;
        case "CONFIRM_ORDER":
          result = await this._handleConfirmOrder(
            session.id,
            context.phoneNumber,
            context.companyId,
            context.branchId
          );
          break;
        default:
          result = {
            success: true,
            response: "No entendí bien. ¿Quieres ver el menú? Escribe 'menú'",
            action: "error",
          };
      }

      await prisma.whatsAppSession.update({
        where: { id: session.id },
        data: {
          state: result.action === "confirm_order" ? "COMPLETED" : session.state,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      await prisma.whatsAppConversation.create({
        data: {
          sessionId: session.id,
          direction: "OUTGOING",
          content: result.response,
        },
      });

      await sender.sendMessage({
        phoneNumber: context.phoneNumber,
        message: result.response,
        whatsappPhoneNumberId: context.whatsappPhoneNumberId,
        whatsappAccessToken: context.whatsappAccessToken,
      });

      return result;
    } catch (error) {
      return {
        success: false,
        response: "Disculpa, hubo un error. Intenta de nuevo.",
        action: "error",
        error: String(error),
      };
    }
  },

  async _handleBrowseMenu(
    sessionId: string,
    companyId: string,
    branchId: string
  ): Promise<ProcessingResult> {
    const categories = await catalogService.getCatalog(companyId, branchId);

    if (!categories || categories.length === 0) {
      return {
        success: false,
        response: "No hay productos disponibles.",
        action: "error",
      };
    }

    // Antes solo se listaban los nombres de las categorías — el cliente
    // no tenía forma de saber qué productos existían ni qué escribir
    // para pedir algo. Ahora se listan los productos con su precio.
    const menuText = categories
      .map((cat: any) => {
        const products = cat.products?.length
          ? cat.products
              .map((p: any) => `  • ${p.name} — $${Number(p.price).toFixed(2)}`)
              .join("\n")
          : "  (sin productos disponibles por ahora)";
        return `*${cat.name}*\n${products}`;
      })
      .join("\n\n");

    return {
      success: true,
      response: `📋 *MENÚ*\n\n${menuText}\n\n¿Qué te gustaría pedir? Escribe el nombre del producto.`,
      action: "browse",
    };
  },

  async _handleAddProduct(
    sessionId: string,
    companyId: string,
    branchId: string,
    products: any[],
    modifiers: any[]
  ): Promise<ProcessingResult> {
    try {
      let cart = await prisma.whatsAppCart.findFirst({
        where: { sessionId, status: "ACTIVE" },
      });

      if (!cart) {
        cart = await prisma.whatsAppCart.create({
          data: {
            sessionId,
            status: "ACTIVE",
            subtotal: 0,
            discount: 0,
            tax: 0,
            total: 0,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        });
      }

      let addedCount = 0;
      const addedNames: string[] = [];
      for (const product of products) {
        const dbProduct = await catalogService.getProduct(product.id, companyId);
        if (dbProduct && dbProduct.stock > 0) {
          await cartManager.addItem(cart.id, {
            productId: dbProduct.id,
            quantity: product.quantity || 1,
            unitPrice: Number(dbProduct.price),
            modifiers: modifiers || [],
          });
          addedCount++;
          addedNames.push(dbProduct.name);
        }
      }

      if (addedCount === 0) {
        return {
          success: false,
          response: "No pudimos agregar los productos. Escribe 'menú' para ver las opciones disponibles.",
          action: "error",
        };
      }

      const updated = await cartManager.updateTotals(cart.id);

      return {
        success: true,
        response: `✅ Agregado: ${addedNames.join(", ")}\n💰 Total del carrito: $${updated.total.toFixed(2)}\n\n¿Algo más? O escribe "confirmar" para cerrar tu pedido.`,
        action: "add_to_cart",
      };
    } catch (error) {
      return {
        success: false,
        response: "Error al agregar producto.",
        action: "error",
        error: String(error),
      };
    }
  },

  async _handleModifyCart(
    sessionId: string,
    companyId: string
  ): Promise<ProcessingResult> {
    const cart = await prisma.whatsAppCart.findFirst({
      where: { sessionId, status: "ACTIVE" },
      include: { items: true },
    });

    if (!cart || cart.items.length === 0) {
      return {
        success: false,
        response: "Tu carrito está vacío.",
        action: "error",
      };
    }

    return {
      success: true,
      response: "Carrito modificado.",
      action: "error",
    };
  },

  async _handleConfirmOrder(
    sessionId: string,
    phoneNumber: string,
    companyId: string,
    branchId: string
  ): Promise<ProcessingResult> {
    try {
      const cart = await prisma.whatsAppCart.findFirst({
        where: { sessionId, status: "ACTIVE" },
      });

      if (!cart) {
        return {
          success: false,
          response: "No hay carrito activo. Escribe 'menú' para empezar tu pedido.",
          action: "error",
        };
      }

      const order = await orderCreator.createOrderFromCart(
        cart.id,
        companyId,
        branchId,
        phoneNumber
      );

      await prisma.whatsAppCart.update({
        where: { id: cart.id },
        data: { status: "CONVERTED", orderId: order.id },
      });

      return {
        success: true,
        response: `✅ ¡ORDEN CONFIRMADA!\n🎫 Ticket: #${order.ticketNumber}\n💰 Total: $${order.total.toFixed(2)}`,
        action: "confirm_order",
        orderId: order.id,
      };
    } catch (error) {
      return {
        success: false,
        response: "Error al confirmar orden.",
        action: "error",
        error: String(error),
      };
    }
  },
};
