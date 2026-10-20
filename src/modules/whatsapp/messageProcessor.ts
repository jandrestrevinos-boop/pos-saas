/**
 * messageProcessor.ts
 * Orquestra el flujo completo de WhatsApp Orders
 */

import { getBranchStock } from "@/modules/inventory/service";
import { prisma } from "@/lib/prisma";
import { aiInterpreter } from "./aiInterpreter";
import { catalogService } from "./catalogService";
import { cartManager } from "./cartManager";
import { orderCreator } from "./orderCreator";
import { sender } from "./sender";
import { menusService } from "@/modules/menus/service";
import { describeGroup, groupPrompt, parseGroupAnswer, isCancelText, formatWaPrice } from "@/lib/whatsapp-menu";
import { pendingOf, choicesOf, isPendingItem } from "./menuState";

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
  action: "browse" | "add_to_cart" | "confirm_order" | "error" | "abandon" | "choose_menu";
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
  // Un menú que el cliente todavía está armando no aparece en el resumen.
  const ready = items.filter((i) => !isPendingItem(i));

  // Menús completos: se listan debajo lo que lleva y, aparte, lo que cobra extra.
  const choiceIds = ready.flatMap((i) => choicesOf(i.modifiers));
  const options: { id: string; extraPrice: unknown; group: { isExtra: boolean }; optionProduct: { name: string } }[] = choiceIds.length
    ? await prisma.menuOption.findMany({
        where: { id: { in: choiceIds } },
        include: { group: { select: { isExtra: true } }, optionProduct: { select: { name: true } } },
      })
    : [];
  const optionById = new Map(options.map((o) => [o.id, o]));

  return ready
    .map((i) => {
      const head = `▫️ ${i.quantity}× ${capitalize(i.product.name)} — ${formatPrice(i.lineTotal)}`;
      const lines = choicesOf(i.modifiers)
        .map((id) => optionById.get(id))
        .filter((o): o is NonNullable<typeof o> => !!o)
        .map((o) => {
          const extra = Number(o.extraPrice);
          const tag = extra > 0 ? ` (+${formatPrice(extra)} extra)` : o.group.isExtra ? " (extra sin costo)" : "";
          return `      ◦ ${capitalize(o.optionProduct.name)}${tag}`;
        });
      return [head, ...lines].join("\n");
    })
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

      // Mientras el cliente arma un menú completo (elige guarnición, bebida...), su mensaje es la
      // respuesta a la pregunta del bot, no un pedido nuevo: no pasa por la IA.
      const choosingMenu = session.state === "CHOOSING_MENU";
      const aiResult = choosingMenu
        ? ({ success: false, intent: "OTHER", fallbackResponse: "", confidence: 0 } as Awaited<ReturnType<typeof aiInterpreter.interpret>>)
        : await aiInterpreter.interpret({
            messageText: context.messageText,
            companyId: context.companyId,
            branchId: context.branchId,
            sessionState: session.state,
          });

      let intent: typeof aiResult.intent | "MENU_ANSWER" = aiResult.success ? aiResult.intent : "OTHER";

      // Un cliente nuevo que solo saluda ("hola") ve el menú de una vez.
      if (isNewSession && intent === "OTHER") {
        intent = "BROWSE_MENU";
      }
      if (choosingMenu) intent = "MENU_ANSWER";

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
        case "MENU_ANSWER":
          result = await this._handleMenuAnswer(session.id, context.companyId, context.messageText);
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
                : result.action === "choose_menu"
                  ? "CHOOSING_MENU"
                  : // Si estaba armando un menú y esa conversación terminó (cancelado/error), regresa a "en carrito".
                    session.state === "CHOOSING_MENU"
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

    // Menús completos: se muestra qué lleva cada uno y qué opciones cobran extra.
    const hasMenus = withProducts.some((cat: any) => cat.products.some((p: any) => p.isMenu));
    const menuConfigs = hasMenus ? await menusService.listForPos(companyId) : [];
    const menuById = new Map(menuConfigs.map((m) => [m.id, m]));

    const sections = withProducts
      .map((cat: any) => {
        const lines = cat.products
          .map((p: any) => {
            const head = `▫️ ${capitalize(p.name)} — *${formatPrice(p.price)}*`;
            const cfg = p.isMenu ? menuById.get(p.id) : undefined;
            return cfg && cfg.groups.length > 0 ? [head, ...cfg.groups.map((g) => `      ◦ ${describeGroup(g)}`)].join("\n") : head;
          })
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
      const deferred: string[] = [];
      let menuToChoose: { name: string; qty: number; groups: NonNullable<Awaited<ReturnType<typeof menusService.getForPos>>> } | null = null;

      // Un menú a medio armar que quedó de antes no debe estorbar: se descarta.
      const staleItems = await prisma.whatsAppCartItem.findMany({ where: { cartId: cart.id } });
      const stalePending = staleItems.filter((i) => isPendingItem(i)).map((i) => i.id);
      if (stalePending.length > 0) await prisma.whatsAppCartItem.deleteMany({ where: { id: { in: stalePending } } });

      for (const product of products) {
        const qty = Math.max(1, Math.floor(Number(product.quantity) || 1));
        const dbProduct = await catalogService.getProduct(product.id, companyId);
        if (!dbProduct) continue;

        // Solo los productos que controlan inventario se bloquean por stock.
        // (La existencia es por sucursal: se compara contra la de la sucursal que atiende este chat.)
        if (dbProduct.tracksInventory && (await getBranchStock(dbProduct.id, branchId)) < qty) {
          unavailable.push(capitalize(dbProduct.name));
          continue;
        }

        // Menú completo con grupos de opciones: el bot pregunta grupo por grupo antes de agregarlo.
        const menuConfig = dbProduct.isMenu ? await menusService.getForPos(companyId, dbProduct.id) : null;
        if (menuConfig) {
          if (menuToChoose) {
            deferred.push(capitalize(dbProduct.name));
            continue;
          }
          await prisma.whatsAppCartItem.create({
            data: {
              cartId: cart.id,
              productId: dbProduct.id,
              quantity: qty,
              unitPrice: Number(dbProduct.price),
              lineTotal: 0, // vale $0 hasta que termine de elegir
              modifiers: { menuPending: { choiceIds: [], groupIndex: 0 } },
              notes: "",
            },
          });
          menuToChoose = { name: capitalize(dbProduct.name), qty, groups: menuConfig };
          continue;
        }

        await cartManager.addItem(branchId, cart.id, {
          productId: dbProduct.id,
          quantity: qty,
          unitPrice: Number(dbProduct.price),
          modifiers: modifiers || [],
        });
        added.push(`${qty}× ${capitalize(dbProduct.name)}`);
      }

      if (menuToChoose) {
        const first = menuToChoose.groups.groups[0];
        await cartManager.updateTotals(cart.id);
        return {
          success: true,
          response: [
            ...(added.length ? [`✅ *Agregado:* ${added.join(", ")}`, ""] : []),
            ...(deferred.length ? [`⚠️ Pide ${deferred.join(", ")} cuando termines este menú.`, ""] : []),
            `🍽️ Vamos a armar tu *${menuToChoose.name}*${menuToChoose.qty > 1 ? ` (${menuToChoose.qty} con las mismas opciones)` : ""}`,
            "",
            groupPrompt(first, 1, menuToChoose.groups.groups.length),
          ].join("\n"),
          action: "choose_menu",
        };
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
          ...(updated.discount > 0 ? [`🏷️ Promoción: -${formatPrice(updated.discount)}`] : []),
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

  /** Respuesta del cliente a la pregunta de un grupo del menú que está armando (guarnición, bebida...). */
  async _handleMenuAnswer(sessionId: string, companyId: string, text: string): Promise<ProcessingResult> {
    const cart = await prisma.whatsAppCart.findFirst({
      where: { sessionId, status: "ACTIVE" },
      include: { items: true },
    });
    const pending = cart?.items.find((i) => isPendingItem(i));
    if (!cart || !pending) {
      return {
        success: true,
        response: "🤔 No tengo ningún menú pendiente.\nEscribe *menú* para ver lo que tenemos disponible.",
        action: "error",
      };
    }

    const dropPending = async () => {
      await prisma.whatsAppCartItem.delete({ where: { id: pending.id } });
      return cartManager.updateTotals(cart.id);
    };

    if (isCancelText(text)) {
      const updated = await dropPending();
      const summary = await buildCartSummary(cart.id);
      return {
        success: true,
        response: summary
          ? ["👌 Listo, quité ese menú.", "", "🛒 *Tu pedido*", summary, "━━━━━━━━━━", `💰 *Total: ${formatPrice(updated.total)}*`, "", "¿Algo más? Escríbelo.", "Cuando termines escribe *confirmar* ✅"].join("\n")
          : "👌 Listo, quité ese menú. Escribe *menú* para ver las opciones.",
        action: "error",
      };
    }

    const config = await menusService.getForPos(companyId, pending.productId);
    const state = pendingOf(pending.modifiers);
    const group = config && state ? config.groups[state.groupIndex] : undefined;
    if (!config || !state || !group) {
      await dropPending();
      return { success: false, response: "😕 Ese menú ya no está disponible. Escribe *menú* para ver las opciones.", action: "error" };
    }

    const total = config.groups.length;
    const parsed = parseGroupAnswer(text, group);
    if (!parsed.ok) {
      return {
        success: true,
        response: `🤔 ${parsed.error}\n\n${groupPrompt(group, state.groupIndex + 1, total)}`,
        action: "choose_menu",
      };
    }

    const choiceIds = [...state.choiceIds, ...parsed.optionIds];
    const nextIndex = state.groupIndex + 1;

    if (nextIndex < total) {
      await prisma.whatsAppCartItem.update({
        where: { id: pending.id },
        data: { modifiers: { menuPending: { choiceIds, groupIndex: nextIndex } } },
      });
      return { success: true, response: groupPrompt(config.groups[nextIndex], nextIndex + 1, total), action: "choose_menu" };
    }

    // Último grupo: el servidor valida todo contra las reglas del menú y calcula el precio final.
    try {
      const resolved = await menusService.resolveChoices(companyId, pending.productId, choiceIds);
      const dbProduct = await catalogService.getProduct(pending.productId, companyId);
      if (!dbProduct) throw new Error("Ese menú ya no está disponible");
      const unitPrice = Number(dbProduct.price) + resolved.extraPrice;

      await prisma.whatsAppCartItem.update({
        where: { id: pending.id },
        data: {
          unitPrice,
          lineTotal: Math.round(unitPrice * pending.quantity * 100) / 100,
          modifiers: { menuChoices: choiceIds },
        },
      });

      const updated = await cartManager.updateTotals(cart.id);
      const summary = await buildCartSummary(cart.id);
      return {
        success: true,
        response: [
          `✅ *Agregado:* ${pending.quantity}× ${capitalize(dbProduct.name)}`,
          ...(resolved.extraPrice > 0 ? [`➕ Incluye ${formatWaPrice(resolved.extraPrice)} de extras`] : []),
          "",
          "🛒 *Tu pedido*",
          summary,
          "━━━━━━━━━━",
          ...(updated.discount > 0 ? [`🏷️ Promoción: -${formatPrice(updated.discount)}`] : []),
          `💰 *Total: ${formatPrice(updated.total)}*`,
          "",
          "¿Algo más? Escríbelo.",
          "Cuando termines escribe *confirmar* ✅",
        ].join("\n"),
        action: "add_to_cart",
      };
    } catch (error) {
      console.error("[MessageProcessor] Error cerrando menú:", error);
      await dropPending();
      return {
        success: false,
        response: `😕 ${error instanceof Error ? error.message : "No pude armar ese menú"}.\nIntenta pedirlo de nuevo o escribe *menú*.`,
        action: "error",
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
        include: { items: { select: { id: true, modifiers: true } } },
      });

      if (!cart || cart.items.filter((i) => !isPendingItem(i)).length === 0) {
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
