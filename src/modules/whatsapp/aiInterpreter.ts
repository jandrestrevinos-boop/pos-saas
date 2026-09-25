/**
 * aiInterpreter.ts
 * Interpreta intención con Claude (con fallback a regex)
 */

import Anthropic from "@anthropic-ai/sdk";
import { catalogService } from "./catalogService";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type Intent = "BROWSE_MENU" | "ADD_PRODUCT" | "MODIFY_CART" | "CONFIRM_ORDER" | "OTHER";

interface AIInterpretResult {
  success: boolean;
  intent: Intent;
  products?: Array<{ id: string; quantity: number }>;
  modifiers?: Array<{ name: string; value: string }>;
  fallbackResponse: string;
  confidence: number;
  error?: string;
}

interface InterpretParams {
  messageText: string;
  companyId: string;
  branchId: string;
  sessionState: string;
}

export const aiInterpreter = {
  async interpret(params: InterpretParams): Promise<AIInterpretResult> {
    try {
      const { messageText, companyId, branchId, sessionState } = params;

      const catalog = await catalogService.getCatalog(companyId, branchId);

      if (!catalog || catalog.length === 0) {
        return {
          success: false,
          intent: "OTHER",
          fallbackResponse: "No hay productos disponibles.",
          confidence: 0,
          error: "Empty catalog",
        };
      }

      // Clave del fix: cada producto lleva su ID real de la base de
      // datos entre corchetes. Sin esto, la IA puede "entender" que el
      // cliente quiere algo, pero no tiene forma de decirle al sistema
      // CUÁL producto exacto es — el carrito nunca se llenaba por esto.
      const catalogText = catalog
        .map((cat: any) => {
          const products = cat.products
            ? cat.products
                .map((p: any) => `- [${p.id}] ${p.name} — $${Number(p.price).toFixed(2)}`)
                .join("\n")
            : "";
          return `${cat.name}:\n${products}`;
        })
        .join("\n\n");

      const systemPrompt = `Eres un asistente de pedidos para restaurante, hablando por WhatsApp con un cliente.

Estado actual de la conversación: ${sessionState}

CATÁLOGO (usa el ID entre corchetes exactamente como aparece, nunca lo inventes ni lo modifiques):
${catalogText}

Interpreta el mensaje del cliente y responde SOLO con este JSON, sin texto adicional:
{
  "intent": "BROWSE_MENU" | "ADD_PRODUCT" | "MODIFY_CART" | "CONFIRM_ORDER" | "OTHER",
  "products": [{"id": "<ID exacto del catálogo>", "quantity": <número>}],
  "confidence": <0 a 1>
}

Reglas:
- "BROWSE_MENU": el cliente pide ver el menú o los productos disponibles.
- "ADD_PRODUCT": el cliente nombra uno o más productos específicos que quiere pedir. SOLO usa este intent si puedes identificar con certeza el ID exacto del catálogo — si el nombre que menciona es ambiguo o no aparece en el catálogo, usa "OTHER" en su lugar y dile que no lo encontraste.
- "CONFIRM_ORDER": el cliente confirma que ya quiere cerrar/pagar su pedido (ej. "ya, eso es todo", "confirmo", "listo para pagar").
- "MODIFY_CART": el cliente quiere quitar o cambiar algo que ya había pedido.
- "OTHER": cualquier otro caso, incluyendo saludos o mensajes que no puedas mapear con certeza a un producto del catálogo.
- Nunca inventes un ID que no esté en el catálogo de arriba.`;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: "user", content: `Cliente: "${messageText}"` }],
      });

      const responseText =
        response.content[0].type === "text" ? response.content[0].text : "";

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this._fallbackInterpret(messageText);
      }

      const aiResult = JSON.parse(jsonMatch[0]);

      return {
        success: true,
        intent: aiResult.intent || "OTHER",
        products: aiResult.products,
        modifiers: aiResult.modifiers,
        fallbackResponse: this._getDefaultResponse(aiResult.intent),
        confidence: aiResult.confidence || 0.5,
      };
    } catch (error) {
      console.error(`[AI Interpreter] Error:`, error);
      return this._fallbackInterpret(params.messageText);
    }
  },

  _fallbackInterpret(messageText: string): AIInterpretResult {
    const lower = messageText.toLowerCase();

    if (lower.includes("menú") || lower.includes("menu")) {
      return {
        success: true,
        intent: "BROWSE_MENU",
        fallbackResponse: "Aquí está el menú...",
        confidence: 0.8,
      };
    }

    if (lower.includes("confirm") || lower.includes("pagar") || lower.includes("listo")) {
      return {
        success: true,
        intent: "CONFIRM_ORDER",
        fallbackResponse: "Confirmando orden...",
        confidence: 0.7,
      };
    }

    return {
      success: false,
      intent: "OTHER",
      fallbackResponse: "No entendí. Escribe 'menú' para ver los productos disponibles.",
      confidence: 0.2,
      error: "Could not parse message",
    };
  },

  _getDefaultResponse(intent: Intent): string {
    const responses: Record<Intent, string> = {
      BROWSE_MENU: "Aquí está nuestro menú...",
      ADD_PRODUCT: "Agregando a tu carrito...",
      MODIFY_CART: "Modificando tu carrito...",
      CONFIRM_ORDER: "Confirmando tu orden...",
      OTHER: "No encontré ese producto en el menú. Escribe 'menú' para ver las opciones disponibles.",
    };

    return responses[intent] || responses.OTHER;
  },
};
