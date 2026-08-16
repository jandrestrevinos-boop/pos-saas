import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export interface TenantContext {
  userId: string;
  companyId: string | null; // null solo para SUPER_ADMIN
  branchId: string | null;
  roleName: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

/**
 * Punto único de verdad para saber "quién está preguntando" en cualquier
 * service o API route. Todo acceso a datos de negocio debe pasar por aquí
 * y filtrar explícitamente por companyId — nunca confiar en un companyId
 * que venga del cliente en el body/query de la petición.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("UNAUTHENTICATED");
  }

  return {
    userId: session.user.id,
    companyId: session.user.companyId ?? null,
    branchId: session.user.branchId ?? null,
    roleName: session.user.roleName,
    permissions: session.user.permissions,
    isSuperAdmin: session.user.roleName === "SUPER_ADMIN",
  };
}

/**
 * Lanza un error si el contexto no tiene una empresa asociada
 * (útil en cualquier endpoint que no sea del panel SUPER_ADMIN).
 */
export function requireCompanyId(ctx: TenantContext): string {
  if (!ctx.companyId) {
    throw new Error("FORBIDDEN: se requiere una empresa asociada");
  }
  return ctx.companyId;
}

/**
 * Resuelve la sucursal a usar: la asignada al usuario si tiene una,
 * o la primera sucursal de la empresa como respaldo.
 */
export async function resolveBranchId(ctx: TenantContext, companyId: string): Promise<string | null> {
  if (ctx.branchId) return ctx.branchId;
  const { prisma } = await import("./prisma");
  const branch = await prisma.branch.findFirst({ where: { companyId } });
  return branch?.id ?? null;
}
