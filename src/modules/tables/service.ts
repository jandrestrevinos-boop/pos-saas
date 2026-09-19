import { prisma } from "@/lib/prisma";
import { z } from "zod";

const NEXT_STATUS: Record<string, string> = {
  LIBRE: "OCUPADA",
  OCUPADA: "CUENTA",
  CUENTA: "LIMPIEZA",
  LIMPIEZA: "LIBRE",
};

export const createTableSchema = z.object({
  name: z.string().min(1, "El nombre de la mesa es requerido").max(60),
  capacity: z.coerce.number().int().positive().optional(),
});

export const updateTableSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  capacity: z.coerce.number().int().positive().nullable().optional(),
  status: z.enum(["LIBRE", "OCUPADA", "CUENTA", "LIMPIEZA"]).optional(),
  isActive: z.boolean().optional(),
});

export const tablesService = {
  async list(companyId: string, branchId: string) {
    return prisma.table.findMany({
      where: { companyId, branchId, isActive: true },
      orderBy: { name: "asc" },
    });
  },

  async create(companyId: string, branchId: string, input: z.infer<typeof createTableSchema>) {
    return prisma.table.create({
      data: { companyId, branchId, name: input.name, capacity: input.capacity ?? null },
    });
  },

  async update(companyId: string, tableId: string, input: z.infer<typeof updateTableSchema>) {
    const table = await prisma.table.findFirst({ where: { id: tableId, companyId } });
    if (!table) throw new Error("Mesa no encontrada");

    return prisma.table.update({
      where: { id: tableId },
      data: input,
    });
  },

  /** Avanza la mesa al siguiente estado del ciclo: Libre → Ocupada → Cuenta → Limpieza → Libre. */
  async advanceStatus(companyId: string, tableId: string) {
    const table = await prisma.table.findFirst({ where: { id: tableId, companyId } });
    if (!table) throw new Error("Mesa no encontrada");

    const next = NEXT_STATUS[table.status];
    return prisma.table.update({ where: { id: tableId }, data: { status: next as never } });
  },

  async remove(companyId: string, tableId: string) {
    const table = await prisma.table.findFirst({ where: { id: tableId, companyId } });
    if (!table) throw new Error("Mesa no encontrada");

    // Soft delete: si la mesa ya tiene órdenes asociadas, borrarla de verdad
    // rompería el historial de ventas. Se desactiva en vez de eliminarse.
    return prisma.table.update({ where: { id: tableId }, data: { isActive: false } });
  },
};
