/**
 * Motor de promociones. Módulo puro (sin base de datos), igual que loyalty-discount.ts:
 * el servidor (ventas) y el POS calculan EXACTAMENTE lo mismo. El servidor es la autoridad.
 *
 * Reglas:
 *  - En cada renglón del carrito se aplica solo la MEJOR promoción por producto/categoría.
 *  - La promoción de ticket completo se calcula DESPUÉS, sobre lo que quedó tras las de renglón.
 *  - Una promoción con cupón solo cuenta si se escribió su código.
 */
export const PROMO_TIMEZONE = "America/Monterrey";

export type PromotionKind = "PERCENT_OFF" | "AMOUNT_OFF" | "BUY_X_PAY_Y";
export type PromotionScope = "PRODUCTS" | "CATEGORIES" | "TICKET";

export type PromotionRule = {
  id: string;
  name: string;
  kind: PromotionKind;
  scope: PromotionScope;
  /** PERCENT_OFF: porcentaje. AMOUNT_OFF: pesos por unidad (renglón) o pesos totales (ticket). */
  value: number | null;
  buyQty: number | null; // "lleva"
  payQty: number | null; // "paga"
  minSubtotal: number | null; // solo ticket completo
  productIds: string[];
  categoryIds: string[];
  couponCode: string | null;
  startsAt: string | null; // ISO
  endsAt: string | null; // ISO
  weekdays: number[]; // 0 = domingo ... 6 = sábado; vacío = todos
  startTime: string | null; // "HH:MM"
  endTime: string | null; // "HH:MM"
};

export type PromoLine = { productId: string; categoryId: string; unitPrice: number; quantity: number };

export type AppliedPromotion = { promotionId: string; name: string; amount: number };

export type PromoResult = { discount: number; applied: AppliedPromotion[] };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Día de la semana y hora (HH:MM) en la zona horaria del restaurante, sin importar el reloj del dispositivo. */
function localParts(now: Date): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PROMO_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** ¿La promoción está vigente en este momento? (fechas, días de la semana y horario). */
export function isPromotionActive(rule: PromotionRule, now: Date): boolean {
  if (rule.startsAt && now < new Date(rule.startsAt)) return false;
  if (rule.endsAt && now > new Date(rule.endsAt)) return false;

  const { weekday, minutes } = localParts(now);
  if (rule.weekdays.length > 0 && !rule.weekdays.includes(weekday)) return false;

  if (rule.startTime && rule.endTime) {
    const start = toMinutes(rule.startTime);
    const end = toMinutes(rule.endTime);
    // Horario que cruza medianoche (ej. 22:00 a 02:00)
    const inside = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    if (!inside) return false;
  }
  return true;
}

function lineMatches(rule: PromotionRule, line: PromoLine): boolean {
  if (rule.scope === "PRODUCTS") return rule.productIds.includes(line.productId);
  if (rule.scope === "CATEGORIES") return rule.categoryIds.includes(line.categoryId);
  return false;
}

/** Descuento que una promoción de renglón da sobre un renglón (0 si no aplica). */
export function lineDiscountFor(rule: PromotionRule, line: PromoLine): number {
  const lineTotal = line.unitPrice * line.quantity;
  if (lineTotal <= 0) return 0;

  if (rule.kind === "PERCENT_OFF" && rule.value) {
    return round2(Math.min((lineTotal * rule.value) / 100, lineTotal));
  }
  if (rule.kind === "AMOUNT_OFF" && rule.value) {
    return round2(Math.min(rule.value * line.quantity, lineTotal));
  }
  if (rule.kind === "BUY_X_PAY_Y" && rule.buyQty && rule.payQty && rule.payQty < rule.buyQty) {
    const groups = Math.floor(line.quantity / rule.buyQty);
    const freeUnits = groups * (rule.buyQty - rule.payQty);
    return round2(Math.min(freeUnits * line.unitPrice, lineTotal));
  }
  return 0;
}

/** Junta renglones del mismo producto y precio (ej. rondas distintas de una mesa) para que un 2x1 los cuente juntos. */
function mergeLines(lines: PromoLine[]): PromoLine[] {
  const merged = new Map<string, PromoLine>();
  for (const l of lines) {
    const key = `${l.productId}|${l.unitPrice}`;
    const cur = merged.get(key);
    if (cur) cur.quantity += l.quantity;
    else merged.set(key, { ...l });
  }
  return [...merged.values()];
}

export function evaluatePromotions(
  rawLines: PromoLine[],
  rules: PromotionRule[],
  opts: { now?: Date; couponCode?: string | null } = {}
): PromoResult {
  const lines = mergeLines(rawLines);
  const now = opts.now ?? new Date();
  const code = opts.couponCode?.trim().toUpperCase() || null;

  const eligible = rules.filter((r) => {
    if (!isPromotionActive(r, now)) return false;
    if (r.couponCode) return code !== null && r.couponCode.toUpperCase() === code;
    return true;
  });

  const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
  const byPromo = new Map<string, AppliedPromotion>();
  const add = (rule: PromotionRule, amount: number) => {
    if (amount <= 0) return;
    const cur = byPromo.get(rule.id) ?? { promotionId: rule.id, name: rule.name, amount: 0 };
    cur.amount = round2(cur.amount + amount);
    byPromo.set(rule.id, cur);
  };

  // 1) Mejor promoción por renglón
  let lineDiscounts = 0;
  const lineRules = eligible.filter((r) => r.scope !== "TICKET");
  for (const line of lines) {
    let best: { rule: PromotionRule; amount: number } | null = null;
    for (const rule of lineRules) {
      if (!lineMatches(rule, line)) continue;
      const amount = lineDiscountFor(rule, line);
      if (amount > (best?.amount ?? 0)) best = { rule, amount };
    }
    if (best) {
      add(best.rule, best.amount);
      lineDiscounts += best.amount;
    }
  }

  // 2) Mejor promoción de ticket completo, sobre lo que quedó
  const afterLines = round2(subtotal - lineDiscounts);
  let bestTicket: { rule: PromotionRule; amount: number } | null = null;
  for (const rule of eligible.filter((r) => r.scope === "TICKET")) {
    if (rule.minSubtotal && afterLines < rule.minSubtotal) continue;
    let amount = 0;
    if (rule.kind === "PERCENT_OFF" && rule.value) amount = round2((afterLines * rule.value) / 100);
    else if (rule.kind === "AMOUNT_OFF" && rule.value) amount = round2(Math.min(rule.value, afterLines));
    if (amount > (bestTicket?.amount ?? 0)) bestTicket = { rule, amount };
  }
  if (bestTicket) add(bestTicket.rule, bestTicket.amount);

  const applied = [...byPromo.values()];
  const discount = round2(Math.min(applied.reduce((s, a) => s + a.amount, 0), subtotal));
  return { discount, applied };
}

/** Texto corto para mostrar qué hace una promoción en las pantallas. */
export function describePromotion(rule: Pick<PromotionRule, "kind" | "scope" | "value" | "buyQty" | "payQty" | "minSubtotal">): string {
  const target = rule.scope === "TICKET" ? "del ticket" : rule.scope === "CATEGORIES" ? "en categorías" : "en productos";
  if (rule.kind === "BUY_X_PAY_Y") return `Lleva ${rule.buyQty}, paga ${rule.payQty}`;
  if (rule.kind === "PERCENT_OFF") return `${rule.value}% ${target}`;
  const unit = rule.scope === "TICKET" ? "" : " por pieza";
  return `$${rule.value} menos${unit} ${target}`;
}
