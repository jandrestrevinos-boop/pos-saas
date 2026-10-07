import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { evaluatePromotions, isPromotionActive, type PromotionRule, type PromoLine, type PromoResult } from "@/lib/promotions";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (usa HH:MM)");

export const promotionSchema = z
  .object({
    name: z.string().trim().min(1, "Ponle un nombre a la promoción").max(80),
    kind: z.enum(["PERCENT_OFF", "AMOUNT_OFF", "BUY_X_PAY_Y"]),
    scope: z.enum(["PRODUCTS", "CATEGORIES", "TICKET"]),
    value: z.coerce.number().positive().optional().nullable(),
    buyQty: z.coerce.number().int().min(2).optional().nullable(),
    payQty: z.coerce.number().int().min(0).optional().nullable(),
    minSubtotal: z.coerce.number().min(0).optional().nullable(),
    productIds: z.array(z.string()).default([]),
    categoryIds: z.array(z.string()).default([]),
    couponCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,20}$/, "El cupón usa 3 a 20 letras, números, guion o guion bajo")
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    maxUses: z.coerce.number().int().positive().optional().nullable(),
    startsAt: z.string().datetime({ offset: true }).optional().nullable(),
    endsAt: z.string().datetime({ offset: true }).optional().nullable(),
    weekdays: z.array(z.number().int().min(0).max(6)).default([]),
    startTime: hhmm.optional().nullable(),
    endTime: hhmm.optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .superRefine((d, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (d.kind === "BUY_X_PAY_Y") {
      if (d.scope === "TICKET") bad("scope", "Lleva X paga Y aplica a productos o categorías, no al ticket completo");
      if (!d.buyQty || d.payQty === null || d.payQty === undefined) bad("buyQty", "Indica cuántos lleva y cuántos paga");
      else if (d.payQty >= d.buyQty) bad("payQty", "Debe pagar menos piezas de las que lleva");
    } else {
      if (!d.value) bad("value", "Indica el valor del descuento");
      if (d.kind === "PERCENT_OFF" && d.value && d.value > 100) bad("value", "El porcentaje no puede pasar de 100");
    }
    if (d.scope === "PRODUCTS" && d.productIds.length === 0) bad("productIds", "Elige al menos un producto");
    if (d.scope === "CATEGORIES" && d.categoryIds.length === 0) bad("categoryIds", "Elige al menos una categoría");
    if ((d.startTime && !d.endTime) || (!d.startTime && d.endTime)) bad("startTime", "Indica hora de inicio y de fin");
    if (d.startsAt && d.endsAt && new Date(d.endsAt) < new Date(d.startsAt)) bad("endsAt", "La fecha final es anterior a la inicial");
  });

export type PromotionInput = z.infer<typeof promotionSchema>;

type PromotionRow = {
  id: string;
  name: string;
  kind: string;
  scope: string;
  value: number | string | null;
  buyQty: number | null;
  payQty: number | null;
  minSubtotal: number | string | null;
  productIds: unknown;
  categoryIds: unknown;
  couponCode: string | null;
  maxUses: number | null;
  usesCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  weekdays: unknown;
  startTime: string | null;
  endTime: string | null;
  isActive: boolean;
  createdAt: Date;
};

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const asNumbers = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : []);
const numOrNull = (v: number | string | null) => (v === null || v === undefined ? null : Number(v));

export function toRule(r: PromotionRow): PromotionRule {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind as PromotionRule["kind"],
    scope: r.scope as PromotionRule["scope"],
    value: numOrNull(r.value),
    buyQty: r.buyQty,
    payQty: r.payQty,
    minSubtotal: numOrNull(r.minSubtotal),
    productIds: asStrings(r.productIds),
    categoryIds: asStrings(r.categoryIds),
    couponCode: r.couponCode,
    startsAt: r.startsAt ? r.startsAt.toISOString() : null,
    endsAt: r.endsAt ? r.endsAt.toISOString() : null,
    weekdays: asNumbers(r.weekdays),
    startTime: r.startTime,
    endTime: r.endTime,
  };
}

const toData = (d: PromotionInput) => ({
  name: d.name,
  kind: d.kind,
  scope: d.scope,
  value: d.kind === "BUY_X_PAY_Y" ? null : d.value ?? null,
  buyQty: d.kind === "BUY_X_PAY_Y" ? d.buyQty ?? null : null,
  payQty: d.kind === "BUY_X_PAY_Y" ? d.payQty ?? null : null,
  minSubtotal: d.scope === "TICKET" ? d.minSubtotal ?? null : null,
  productIds: d.scope === "PRODUCTS" ? d.productIds : [],
  categoryIds: d.scope === "CATEGORIES" ? d.categoryIds : [],
  couponCode: d.couponCode || null,
  maxUses: d.maxUses ?? null,
  startsAt: d.startsAt ? new Date(d.startsAt) : null,
  endsAt: d.endsAt ? new Date(d.endsAt) : null,
  weekdays: d.weekdays,
  startTime: d.startTime ?? null,
  endTime: d.endTime ?? null,
  isActive: d.isActive,
});

export const promotionsService = {
  /** Lista completa para la pantalla de administración. */
  async list(companyId: string) {
    const rows = (await prisma.promotion.findMany({
      where: { companyId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    })) as unknown as PromotionRow[];
    return rows.map((r) => ({
      ...toRule(r),
      maxUses: r.maxUses,
      usesCount: r.usesCount,
      isActive: r.isActive,
    }));
  },

  async create(companyId: string, input: PromotionInput) {
    return prisma.promotion.create({ data: { companyId, ...toData(input) } });
  },

  async update(companyId: string, id: string, input: PromotionInput) {
    const existing = await prisma.promotion.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error("Promoción no encontrada");
    return prisma.promotion.update({ where: { id }, data: toData(input) });
  },

  async setActive(companyId: string, id: string, isActive: boolean) {
    const res = await prisma.promotion.updateMany({ where: { id, companyId }, data: { isActive } });
    if (res.count === 0) throw new Error("Promoción no encontrada");
  },

  async remove(companyId: string, id: string) {
    // Las ventas ya hechas conservan su descuento y el nombre de la promoción (OrderPromotion.promotionId queda en null).
    const res = await prisma.promotion.deleteMany({ where: { id, companyId } });
    if (res.count === 0) throw new Error("Promoción no encontrada");
  },

  /** Promociones activas de la empresa. Las de cupón solo se incluyen si coincide el código. */
  async activeRules(companyId: string, couponCode?: string | null): Promise<PromotionRule[]> {
    const rows = (await prisma.promotion.findMany({ where: { companyId, isActive: true } })) as unknown as PromotionRow[];
    const code = couponCode?.trim().toUpperCase() || null;
    return rows
      .filter((r) => (r.maxUses === null ? true : r.usesCount < r.maxUses))
      .filter((r) => (r.couponCode ? code !== null && r.couponCode.toUpperCase() === code : true))
      .map(toRule);
  },

  /** Valida un cupón escrito por el cajero. Devuelve la promoción o lanza un error entendible. */
  async validateCoupon(companyId: string, code: string) {
    const clean = code.trim().toUpperCase();
    const row = (await prisma.promotion.findFirst({
      where: { companyId, couponCode: clean },
    })) as unknown as PromotionRow | null;
    if (!row || !row.isActive) throw new Error("El cupón no existe o está desactivado");
    if (row.maxUses !== null && row.usesCount >= row.maxUses) throw new Error("Este cupón ya llegó a su límite de usos");
    const rule = toRule(row);
    if (!isPromotionActive(rule, new Date())) throw new Error("Este cupón no está vigente en este momento");
    return rule;
  },

  /**
   * Calcula las promociones de una venta. Si viene un cupón, debe ser válido
   * (si no, lanza error para que el cajero lo corrija en vez de cobrar de más).
   */
  async evaluateForSale(companyId: string, lines: PromoLine[], couponCode?: string | null): Promise<PromoResult> {
    if (couponCode?.trim()) await this.validateCoupon(companyId, couponCode);
    const rules = await this.activeRules(companyId, couponCode);
    return evaluatePromotions(lines, rules, { couponCode });
  },

  /** Guarda qué promociones se aplicaron a la orden y suma un uso a las que tienen cupón. */
  async recordApplications(tx: Prisma.TransactionClient, orderId: string, applied: PromoResult["applied"], couponCode?: string | null) {
    if (applied.length === 0) return;
    await tx.orderPromotion.createMany({
      data: applied.map((a) => ({ orderId, promotionId: a.promotionId, name: a.name, amount: a.amount })),
    });
    if (couponCode?.trim()) {
      for (const a of applied) {
        await tx.promotion.updateMany({
          where: { id: a.promotionId, couponCode: couponCode.trim().toUpperCase() },
          data: { usesCount: { increment: 1 } },
        });
      }
    }
  },

  /** Si se cancela la venta, el cupón recupera su uso. */
  async revertForOrder(orderId: string) {
    const used = (await prisma.orderPromotion.findMany({
      where: { orderId },
      include: { promotion: { select: { couponCode: true } } },
    })) as unknown as { promotionId: string | null; promotion: { couponCode: string | null } | null }[];
    for (const u of used) {
      if (u.promotionId && u.promotion?.couponCode) {
        await prisma.promotion.updateMany({
          where: { id: u.promotionId, usesCount: { gt: 0 } },
          data: { usesCount: { decrement: 1 } },
        });
      }
    }
  },
};
