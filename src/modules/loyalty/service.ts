import { randomBytes, randomInt } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";

/**
 * Programa de clientes frecuentes.
 *
 * Cada cliente tiene una tarjeta digital con un QR personal fijo (Customer.cardToken).
 * El personal del restaurante escanea ese QR para registrar una visita (compra) y,
 * al llegar a `visitsRequired`, canjea el descuento. Funciona con o sin POS.
 *
 * Reglas de seguridad:
 *  - Solo el personal con sesión iniciada puede registrar visitas y canjes (el cliente
 *    tiene que estar presente); el cliente nunca se auto-suma visitas.
 *  - Todo se filtra por companyId; el token del QR por sí solo no da acceso a otra empresa.
 *  - Visita y canje se hacen dentro de una transacción con bloqueo de fila, para que dos
 *    escaneos simultáneos no sumen doble ni canjeen dos veces.
 */

const TZ = "America/Monterrey";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I para que sea fácil de teclear

const newToken = (bytes: number) => randomBytes(bytes).toString("base64url");

function newShortCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Día calendario ("YYYY-MM-DD") en la zona horaria de México, para "una visita por día". */
function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("521")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("52")) digits = digits.slice(2);
  if (digits.length !== 10) throw new Error("Escribe un celular de 10 dígitos");
  return digits;
}

export function describeDiscount(type: "PERCENT" | "FIXED", value: number): string {
  return type === "PERCENT" ? `${value}% de descuento` : `$${value} MXN de descuento`;
}

export const programSchema = z
  .object({
    isActive: z.boolean().optional(),
    visitsRequired: z.coerce.number().int("Debe ser un número entero").min(2, "Mínimo 2 visitas").max(50, "Máximo 50 visitas").optional(),
    discountType: z.enum(["PERCENT", "FIXED"]).optional(),
    discountValue: z.coerce.number().positive("El descuento debe ser mayor a 0").max(100000).optional(),
    oneVisitPerDay: z.boolean().optional(),
    displayName: z.string().trim().max(60).nullable().optional(),
  })
  .refine((v) => !(v.discountType === "PERCENT" && v.discountValue !== undefined && v.discountValue > 100), {
    message: "Un descuento en porcentaje no puede pasar de 100",
  });

export const enrollSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  phone: z.string().trim().min(1, "Escribe tu celular"),
});

type ProgramRow = NonNullable<Awaited<ReturnType<typeof prisma.loyaltyProgram.findUnique>>>;

function serializeProgram(p: ProgramRow) {
  return {
    id: p.id,
    isActive: p.isActive,
    visitsRequired: p.visitsRequired,
    discountType: p.discountType as "PERCENT" | "FIXED",
    discountValue: Number(p.discountValue),
    oneVisitPerDay: p.oneVisitPerDay,
    signupToken: p.signupToken,
    displayName: p.displayName,
  };
}

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  shortCode: string | null;
  visitsInCycle: number;
  lastVisitAt: Date | null;
};

function summarize(customer: CustomerRow, program: ProgramRow) {
  const required = program.visitsRequired;
  const visitedToday =
    program.oneVisitPerDay && !!customer.lastVisitAt && dayKey(customer.lastVisitAt) === dayKey(new Date());
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    shortCode: customer.shortCode,
    visits: customer.visitsInCycle,
    required,
    rewardAvailable: customer.visitsInCycle >= required,
    visitedToday,
    lastVisitAt: customer.lastVisitAt,
    programActive: program.isActive,
    discountText: describeDiscount(program.discountType as "PERCENT" | "FIXED", Number(program.discountValue)),
  };
}

async function getProgramRow(companyId: string): Promise<ProgramRow> {
  // upsert: la primera vez que la empresa entra al módulo se crea su programa con el QR de alta.
  return prisma.loyaltyProgram.upsert({
    where: { companyId },
    update: {},
    create: { companyId, signupToken: newToken(16) },
  });
}

async function uniqueShortCode(companyId: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = newShortCode();
    const taken = await prisma.customer.findFirst({ where: { companyId, shortCode: code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error("No se pudo generar el código de la tarjeta, intenta de nuevo");
}

async function enroll(
  companyId: string,
  input: z.infer<typeof enrollSchema>,
  opts: { userId?: string }
) {
  const phone = normalizePhone(input.phone);
  const existing = await prisma.customer.findFirst({ where: { companyId, phone } });

  if (existing?.cardToken) {
    // Registro público: NO se entrega la tarjeta de alguien que ya la tiene (si no, cualquiera que
    // conozca un celular podría quedarse con su tarjeta). El personal sí puede recuperarla.
    if (!opts.userId) {
      throw new Error("Este número ya está registrado. Pide tu tarjeta al personal del restaurante.");
    }
    return { customer: existing, created: false };
  }

  const cardData = {
    cardToken: newToken(24),
    shortCode: await uniqueShortCode(companyId),
    loyaltyJoinedAt: new Date(),
  };

  const customer = existing
    ? await prisma.customer.update({ where: { id: existing.id }, data: cardData })
    : await prisma.customer.create({ data: { companyId, name: input.name, phone, ...cardData } });

  if (opts.userId) {
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: opts.userId,
        action: "LOYALTY_ENROLL",
        entity: "Customer",
        entityId: customer.id,
        newData: { name: customer.name },
      },
    });
  }
  return { customer, created: true };
}

/** Bloquea la fila del cliente durante la transacción (evita doble visita / doble canje simultáneos). */
async function lockCustomer(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], companyId: string, customerId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM customers WHERE id = ${customerId} AND "companyId" = ${companyId} FOR UPDATE`;
  if (rows.length === 0) throw new Error("Cliente no encontrado");
}

export const loyaltyService = {
  // ───────────── Administración (LOYALTY_MANAGE) ─────────────
  async getProgram(companyId: string) {
    return serializeProgram(await getProgramRow(companyId));
  },

  async updateProgram(companyId: string, userId: string, input: z.infer<typeof programSchema>) {
    const before = await getProgramRow(companyId);
    const type = input.discountType ?? before.discountType;
    const value = input.discountValue ?? Number(before.discountValue);
    if (type === "PERCENT" && value > 100) throw new Error("Un descuento en porcentaje no puede pasar de 100");

    const updated = await prisma.loyaltyProgram.update({
      where: { companyId },
      data: {
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.visitsRequired !== undefined ? { visitsRequired: input.visitsRequired } : {}),
        ...(input.discountType !== undefined ? { discountType: input.discountType } : {}),
        ...(input.discountValue !== undefined ? { discountValue: input.discountValue } : {}),
        ...(input.oneVisitPerDay !== undefined ? { oneVisitPerDay: input.oneVisitPerDay } : {}),
        ...(input.displayName !== undefined ? { displayName: input.displayName || null } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "LOYALTY_PROGRAM_UPDATE",
        entity: "LoyaltyProgram",
        entityId: updated.id,
        previousData: serializeProgram(before) as object,
        newData: serializeProgram(updated) as object,
      },
    });
    return serializeProgram(updated);
  },

  /** Genera un QR de alta nuevo (el anterior deja de funcionar). Útil si alguien lo está usando mal. */
  async rotateSignupToken(companyId: string, userId: string) {
    await getProgramRow(companyId);
    const updated = await prisma.loyaltyProgram.update({ where: { companyId }, data: { signupToken: newToken(16) } });
    await prisma.auditLog.create({
      data: { companyId, userId, action: "LOYALTY_SIGNUP_QR_ROTATE", entity: "LoyaltyProgram", entityId: updated.id },
    });
    return serializeProgram(updated);
  },

  async stats(companyId: string) {
    const program = await getProgramRow(companyId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [customers, visits, redemptions, pending] = await Promise.all([
      prisma.customer.count({ where: { companyId, cardToken: { not: null } } }),
      prisma.loyaltyVisit.count({ where: { companyId, createdAt: { gte: since } } }),
      prisma.loyaltyRedemption.count({ where: { companyId, createdAt: { gte: since } } }),
      prisma.customer.count({
        where: { companyId, cardToken: { not: null }, visitsInCycle: { gte: program.visitsRequired } },
      }),
    ]);
    return { customers, visits30d: visits, redemptions30d: redemptions, pendingRewards: pending };
  },

  async listCustomers(companyId: string, q?: string) {
    const term = q?.trim();
    const digits = term?.replace(/\D/g, "");
    return prisma.customer.findMany({
      where: {
        companyId,
        cardToken: { not: null },
        ...(term
          ? {
              OR: [
                { name: { contains: term, mode: "insensitive" as const } },
                ...(digits ? [{ phone: { contains: digits } }] : []),
                { shortCode: { equals: term.toUpperCase() } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastVisitAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        name: true,
        phone: true,
        cardToken: true,
        shortCode: true,
        visitsInCycle: true,
        lastVisitAt: true,
        createdAt: true,
      },
    });
  },

  // ───────────── Operación del personal (LOYALTY_SCAN) ─────────────
  /** Acepta el contenido del QR (URL de la tarjeta), el token solo, o el código corto de 6 caracteres. */
  async lookup(companyId: string, rawCode: string) {
    const code = rawCode.trim();
    if (!code) throw new Error("Escanea una tarjeta o escribe el código");

    const fromUrl = code.match(/tarjeta\/([A-Za-z0-9_-]{20,})/);
    const token = fromUrl ? fromUrl[1] : /^[A-Za-z0-9_-]{20,}$/.test(code) ? code : null;

    const customer = token
      ? await prisma.customer.findFirst({ where: { companyId, cardToken: token } })
      : await prisma.customer.findFirst({
          where: { companyId, shortCode: code.toUpperCase().replace(/[^A-Z0-9]/g, "") },
        });
    if (!customer) throw new Error("No encontramos esa tarjeta en este restaurante");

    return summarize(customer, await getProgramRow(companyId));
  },

  async enrollByStaff(companyId: string, userId: string, input: z.infer<typeof enrollSchema>) {
    const { customer, created } = await enroll(companyId, input, { userId });
    const program = await getProgramRow(companyId);
    return { customer: summarize(customer, program), cardToken: customer.cardToken as string, created };
  },

  async registerVisit(companyId: string, userId: string, branchId: string | null, customerId: string) {
    return prisma.$transaction(async (tx) => {
      await lockCustomer(tx, companyId, customerId);
      const customer = await tx.customer.findFirstOrThrow({ where: { id: customerId, companyId } });
      const program = await tx.loyaltyProgram.findUnique({ where: { companyId } });
      if (!program || !program.isActive) throw new Error("El programa de clientes frecuentes está pausado");

      const now = new Date();
      if (program.oneVisitPerDay && customer.lastVisitAt && dayKey(customer.lastVisitAt) === dayKey(now)) {
        throw new Error("Este cliente ya registró una visita hoy");
      }

      await tx.loyaltyVisit.create({ data: { companyId, customerId, branchId, userId } });
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: { visitsInCycle: { increment: 1 }, lastVisitAt: now },
      });
      return summarize(updated, program);
    });
  },

  async redeem(companyId: string, userId: string, branchId: string | null, customerId: string) {
    return prisma.$transaction(async (tx) => {
      await lockCustomer(tx, companyId, customerId);
      const customer = await tx.customer.findFirstOrThrow({ where: { id: customerId, companyId } });
      const program = await tx.loyaltyProgram.findUnique({ where: { companyId } });
      if (!program || !program.isActive) throw new Error("El programa de clientes frecuentes está pausado");
      if (customer.visitsInCycle < program.visitsRequired) {
        throw new Error(`Aún no llega a ${program.visitsRequired} visitas`);
      }

      const redemption = await tx.loyaltyRedemption.create({
        data: {
          companyId,
          customerId,
          branchId,
          userId,
          discountType: program.discountType,
          discountValue: program.discountValue,
          visitsUsed: program.visitsRequired,
        },
      });
      // Se descuentan solo las visitas del ciclo: si el cliente ya llevaba de más, el excedente se conserva.
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: { visitsInCycle: { decrement: program.visitsRequired } },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "LOYALTY_REDEEM",
          entity: "Customer",
          entityId: customerId,
          newData: {
            redemptionId: redemption.id,
            discountType: program.discountType,
            discountValue: Number(program.discountValue),
            visitsUsed: program.visitsRequired,
          },
        },
      });
      return { ...summarize(updated, program), redeemed: describeDiscount(program.discountType as "PERCENT" | "FIXED", Number(program.discountValue)) };
    });
  },

  // ───────────── Público (cliente final, sin sesión) ─────────────
  /** Datos de la página de registro. null = el programa no existe, está pausado o la empresa no lo tiene contratado. */
  async getSignupInfo(signupToken: string) {
    const program = await prisma.loyaltyProgram.findUnique({
      where: { signupToken },
      include: { company: { select: { name: true, status: true } } },
    });
    if (!program || !program.isActive || program.company.status !== "ACTIVE") return null;
    if (!(await hasFeature(program.companyId, FEATURE_KEYS.CLIENTES_FRECUENTES))) return null;
    return {
      restaurantName: program.displayName || program.company.name,
      visitsRequired: program.visitsRequired,
      discountText: describeDiscount(program.discountType as "PERCENT" | "FIXED", Number(program.discountValue)),
    };
  },

  async registerPublic(signupToken: string, input: z.infer<typeof enrollSchema>) {
    const program = await prisma.loyaltyProgram.findUnique({ where: { signupToken } });
    if (!program || !program.isActive) throw new Error("Este programa no está disponible");
    if (!(await hasFeature(program.companyId, FEATURE_KEYS.CLIENTES_FRECUENTES))) {
      throw new Error("Este programa no está disponible");
    }
    const { customer } = await enroll(program.companyId, input, {});
    return { cardToken: customer.cardToken as string };
  },

  /** Datos de la tarjeta digital del cliente. */
  async getCard(cardToken: string) {
    const customer = await prisma.customer.findUnique({
      where: { cardToken },
      include: { company: { select: { name: true, status: true } } },
    });
    if (!customer || customer.company.status !== "ACTIVE") return null;
    if (!(await hasFeature(customer.companyId, FEATURE_KEYS.CLIENTES_FRECUENTES))) return null;

    const program = await getProgramRow(customer.companyId);
    return {
      ...summarize(customer, program),
      restaurantName: program.displayName || customer.company.name,
    };
  },
};
