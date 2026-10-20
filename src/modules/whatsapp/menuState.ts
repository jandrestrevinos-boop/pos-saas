/**
 * Estado de un menú completo dentro del carrito de WhatsApp. Se guarda en WhatsAppCartItem.modifiers
 * (JSON) para no tocar la base de datos:
 *  - { menuPending: { choiceIds, groupIndex } }  → el cliente todavía está eligiendo; el renglón vale $0
 *    y NO cuenta en totales, promociones ni en el pedido.
 *  - { menuChoices: [ids de MenuOption] }        → elección completa; el renglón ya tiene su precio final.
 * Los productos normales siguen guardando un arreglo (modifiers vacío), igual que antes.
 */
export interface PendingMenu {
  choiceIds: string[];
  groupIndex: number;
}

type Json = unknown;

function asObject(modifiers: Json): Record<string, unknown> | null {
  return modifiers && typeof modifiers === "object" && !Array.isArray(modifiers) ? (modifiers as Record<string, unknown>) : null;
}

export function pendingOf(modifiers: Json): PendingMenu | null {
  const p = asObject(modifiers)?.menuPending as Partial<PendingMenu> | undefined;
  if (!p || !Array.isArray(p.choiceIds) || typeof p.groupIndex !== "number") return null;
  return { choiceIds: p.choiceIds.filter((x): x is string => typeof x === "string"), groupIndex: p.groupIndex };
}

export function choicesOf(modifiers: Json): string[] {
  const c = asObject(modifiers)?.menuChoices;
  return Array.isArray(c) ? c.filter((x): x is string => typeof x === "string") : [];
}

export function isPendingItem(item: { modifiers: Json }): boolean {
  return pendingOf(item.modifiers) !== null;
}
