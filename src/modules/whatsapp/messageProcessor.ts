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

const SESSION_MINUTES = 30;
const sessionExpiry = () => new Date(Date.now() + SESSION_MINUTES * 60 * 1000);

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
  // Mensaje de bienvenida que cada restaurante configura en /settings.
  welcomeMessage?: string;
}

interface ProcessingResult {
  success: boolean;
  response: string;
  action: "browse" | "add_to_cart" | "confirm_order" | "error" | "abandon";
  orderId?: string;
  error?: string;
}

// ---------- Helpers de formato (solo presentación) ----------

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatPrice(value: number | string): string {
  const n = Number(value);
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

function categoryEmoji(name: string): string {
  const n = name.toLowerCase();
  if (/(refresc|bebida|agua|jugo|t[eé]\b|caf[eé]|cerveza|licuado)/.test(n)) return "🥤";
  if (/(dulce|postre|pastel|helado)/.test(n)) return "🍰";
  if (/(salad|taco|comida|antojito|torta|hamburg|pizza|desayuno|cena)/.test(n)) return "🌮";
  return "🍽️";
}

async function buildCartSummary(cartId: string): Promise<string> {
  const items = await prisma.whatsAppCartItem.findMany({
    where: { cartId },
    include: { product: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return items
    .map((i) => `▫️ ${i.quantity}× ${capitalize(i.product.name)} — ${formatPrice(i.lineTotal)}`)
    .join("\n");
}

export const messageProcessor = {
  async processMessage(context: MessageContext): Promise<ProcessingResult> {
    try {
      // Meta reintenta un webhook si tarda en responder; sin este chequeo
      // el mismo mensaje se procesaría dos veces (doble producto agregado
      // o doble orden).
      if (context.messageId) {
        const duplicate = await prisma.whatsAppConversation.findFirst({
          where: { messageId: context.messageId },
          select: { id: true },
        });
        if (duplicate) {
          return { success: true, response: "", action: "browse" };
        }
      }

      let session = await prisma.whatsAppSession.findFirst({
        where: { phoneNumber: context.phoneNumber, companyId: context.companyId },
        orderBy: { createdAt: "desc" },
      });

      let isNewSession = false;

      if (!session) {
        session = await prisma.whatsAppSession.create({
          data: {
            phoneNumber: context.phoneNumber,
            customerId: null,
            companyId: context.companyId,
            state: "BROWSING",
            expiresAt: sessionExpiry(),
          },
        });
        isNewSession = true;
      }

      // Sesión vencida (el cliente vuelve horas o días después): en vez de
      // avisarle "tu sesión expiró", la reiniciamos en silencio y
      // atendemos su mensaje como una conversación nueva. El carrito viejo
      // se abandona para que no se mezcle con el pedido de hoy.
      if (session.expiresAt < new Date()) {
        await prisma.whatsAppCart.updateMany({
          where: { sessionId: session.id, status: "ACTIVE" },
          data: { status: "ABANDONED" },
        });
        session = await prisma.whatsAppSession.update({
          where: { id: session.id },
          data: { state: "BROWSING", expiresAt: sessionExpiry() },
        });
        isNewSession = true;
      }

      // Pedido anterior ya cerrado: la siguiente conversación arranca limpia.
      if (session.state === "COMPLETED") {
        session = await prisma.whatsAppSession.update({
          where: { id: session.id },
          data: { state: "BROWSING" },
        });
      }

      await prisma.whatsAppConversation.create({
        data: {
          sessionId: session.id,
          direction: "INCOMING",
          content: context.messageText,
          messageId: context.messageId,
        },
      });

      const aiResult = await aiInterpreter.interpret({
        messageText: context.messageText,
        companyId: context.companyId,
        branchId: context.branchId,
        sessionState: session.state,
      });

      let intent: typeof aiResult.intent = aiResult.success ? aiResult.intent : "OTHER";

      // Un cliente nuevo que solo saluda ("hola") ve el menú de una vez.
      if (isNewSession && intent === "OTHER") {
        intent = "BROWSE_MENU";
      }

      let result: ProcessingResult;

      switch (intent) {
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
            response: "🤔 No encontré eso en el menú.\nEscribe *menú* para ver lo que tenemos disponible.",
            action: "error",
          };
      }

      // Saludo de bienvenida solo al inicio de una conversación nueva.
      if (isNewSession && result.action === "browse" && context.welcomeMessage) {
        result.response = `👋 ${context.welcomeMessage}\n\n${result.response}`;
      }

      await prisma.whatsAppSession.update({
        where: { id: session.id },
        data: {
          state:
            result.action === "confirm_order"
              ? "COMPLETED"
              : result.action === "add_to_cart"
                ? "IN_CART"
                : session.state,
          expiresAt: sessionExpiry(),
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
      console.error("[MessageProcessor] Error:", error);

      // Mejor esfuerzo: que el cliente nunca se quede sin respuesta.
      await sender.sendMessage({
        phoneNumber: context.phoneNumber,
        message: "😕 Tuvimos un problema procesando tu mensaje. Intenta de nuevo en un momento.",
        whatsappPhoneNumberId: context.whatsappPhoneNumberId,
        whatsappAccessToken: context.whatsappAccessToken,
      });

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
    const withProducts = (categories || []).filter((cat: any) => cat.products?.length > 0);

    if (withProducts.length === 0) {
      return {
        success: false,
        response: "😕 Por ahora no tenemos productos disponibles. ¡Vuelve a intentarlo en un rato!",
        action: "error",
      };
    }

    const sections = withProducts
      .map((cat: any) => {
        const lines = cat.products
          .map((p: any) => `▫️ ${capitalize(p.name)} — *${formatPrice(p.price)}*`)
          .join("\n");
        return `${categoryEmoji(cat.name)} *${cat.name.toUpperCase()}*\n${lines}`;
      })
      .join("\n\n");

    const response = [
      "📋 *NUESTRO MENÚ*",
      "━━━━━━━━━━",
      sections,
      "━━━━━━━━━━",
      "✍️ *¿Cómo pedir?*",
      "Escríbeme lo que se te antoje, por ejemplo:",
      '_"2 coca cero y un taco de asada"_',
      "",
      "Cuando termines escribe *confirmar* ✅",
    ].join("\n");

    return { success: true, response, action: "browse" };
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
            expiresAt: sessionExpiry(),
          },
        });
      }

      const added: string[] = [];
      const unavailable: string[] = [];

      for (const product of products) {
        const qty = Math.max(1, Math.floor(Number(product.quantity) || 1));
        const dbProduct = await catalogService.getProduct(product.id, companyId);
        if (!dbProduct) continue;

        // Solo los productos que controlan inventario se bloquean por stock.
        if (dbProduct.tracksInventory && dbProduct.stock < qty) {
          unavailable.push(capitalize(dbProduct.name));
          continue;
        }

        await cartManager.addItem(cart.id, {
          productId: dbProduct.id,
          quantity: qty,
          unitPrice: Number(dbProduct.price),
          modifiers: modifiers || [],
        });
        added.push(`${qty}× ${capitalize(dbProduct.name)}`);
      }

      if (added.length === 0) {
        return {
          success: false,
          response: unavailable.length
            ? `😕 Ya no tenemos disponible: ${unavailable.join(", ")}.\nEscribe *menú* para ver otras opciones.`
            : "🤔 No pude encontrar ese producto.\nEscribe *menú* para ver las opciones disponibles.",
          action: "error",
        };
      }

      const updated = await cartManager.updateTotals(cart.id);
      const summary = await buildCartSummary(cart.id);

      const notice = unavailable.length ? `\n⚠️ Sin existencias: ${unavailable.join(", ")}` : "";

      return {
        success: true,
        response: [
          `✅ *Agregado:* ${added.join(", ")}${notice}`,
          "",
          "🛒 *Tu pedido*",
          summary,
          "━━━━━━━━━━",
          `💰 *Total: ${formatPrice(updated.total)}*`,
          "",
          "¿Algo más? Escríbelo.",
          "Cuando termines escribe *confirmar* ✅",
        ].join("\n"),
        action: "add_to_cart",
      };
    } catch (error) {
      console.error("[MessageProcessor] Error agregando producto:", error);
      return {
        success: false,
        response: "😕 No pude agregar ese producto. Intenta de nuevo o escribe *menú*.",
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
        response: "🛒 Tu pedido está vacío. Escribe *menú* para empezar.",
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
        include: { items: { select: { id: true } } },
      });

      if (!cart || cart.items.length === 0) {
        return {
          success: false,
          response: "🛒 Todavía no tienes productos en tu pedido. Escribe *menú* para empezar.",
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
        response: [
          "🎉 *¡Pedido confirmado!*",
          `🎫 Ticket: *#${order.ticketNumber}*`,
          `💰 Total: *${formatPrice(order.total)}*`,
          "",
          "Ya lo estamos preparando 👨‍🍳 ¡Gracias por tu pedido!",
        ].join("\n"),
        action: "confirm_order",
        orderId: order.id,
      };
    } catch (error) {
      console.error("[MessageProcessor] Error confirmando orden:", error);
      return {
        success: false,
        response: "😕 No pude confirmar tu pedido. Intenta de nuevo en un momento.",
        action: "error",
        error: String(error),
      };
    }
  },
};
