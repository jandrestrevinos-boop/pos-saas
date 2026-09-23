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
  products?: Array<{ id: string; name: string; quantity: number }>;
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
      const { messageText, companyId, branchId } = params;

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

      const catalogText = catalog
        .map((cat: any) => {
          const products = cat.products
            ? cat.products.map((p: any) => `- ${p.name}`).join("\n")
            : "";
          return `${cat.name}:\n${products}`;
        })
        .join("\n\n");

      const systemPrompt = `Eres un asistente de pedidos para restaurante.
Tu trabajo es interpretar qué quiere el cliente.

CATÁLOGO:
${catalogText}

RESPONDE SOLO CON JSON:
{
  "intent": "BROWSE_MENU" | "ADD_PRODUCT" | "MODIFY_CART" | "CONFIRM_ORDER" | "OTHER",
  "products": [],
  "confidence": 0.8
}`;

      const response = await anthropic.messages.create({
        // claude-sonnet-4-20250514 fue retirado por Anthropic el 15 de
        // junio de 2026 — este es su reemplazo recomendado.
        model: "claude-sonnet-4-6",
        max_tokens: 200,
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
      fallbackResponse: "No entendí. Escribe 'menú'.",
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
      OTHER: "¿Qué deseas?",
    };

    return responses[intent] || responses.OTHER;
  },
};
