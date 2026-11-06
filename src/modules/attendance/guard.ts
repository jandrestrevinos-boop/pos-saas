import { NextResponse } from "next/server";
import { getTenantContext, type TenantContext } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";

/**
 * Validación común de las rutas de /api/attendance:
 *  - "kiosk": cualquier usuario con sesión en el equipo (el empleado se identifica con su PIN).
 *  - "manage": quien administra usuarios (Administrador y Gerente) — empleados, reportes, correcciones.
 * En ambos casos la empresa debe tener la feature "checador_asistencia" en su plan.
 */
export async function attendanceGuard(
  mode: "kiosk" | "manage"
): Promise<{ ctx: TenantContext; companyId: string; error?: undefined } | { error: NextResponse }> {
  let ctx: TenantContext;
  try {
    ctx = await getTenantContext();
  } catch {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }
  if (!ctx.companyId) {
    return { error: NextResponse.json({ error: "Se requiere una empresa" }, { status: 403 }) };
  }
  if (mode === "manage" && !hasPermission(ctx.permissions, PERMISSIONS.USERS_MANAGE)) {
    return { error: NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 }) };
  }
  if (!(await hasFeature(ctx.companyId, FEATURE_KEYS.CHECADOR_ASISTENCIA))) {
    return { error: NextResponse.json({ error: "Tu plan no incluye el checador de asistencia" }, { status: 403 }) };
  }
  return { ctx, companyId: ctx.companyId };
}

export function errorResponse(err: unknown, fallback: string) {
  return NextResponse.json({ error: err instanceof Error ? err.message : fallback }, { status: 400 });
}
