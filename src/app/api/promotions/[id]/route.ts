import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { promotionsService, promotionSchema } from "@/modules/promotions/service";

async function authorize() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);
  if (!hasPermission(ctx.permissions, PERMISSIONS.PRODUCTS_MANAGE)) return { error: true as const, companyId };
  return { error: false as const, companyId };
}

const forbidden = () => NextResponse.json({ error: "No tienes permiso para editar promociones" }, { status: 403 });

// Editar una promoción completa
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await authorize();
  if (auth.error) return forbidden();

  const parsed = promotionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    await promotionsService.update(auth.companyId, params.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("Unique")
        ? "Ya existe una promoción con ese cupón"
        : err instanceof Error
          ? err.message
          : "No se pudo guardar la promoción";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// Activar o pausar
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await authorize();
  if (auth.error) return forbidden();

  const parsed = z.object({ isActive: z.boolean() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Dato inválido" }, { status: 400 });

  try {
    await promotionsService.setActive(auth.companyId, params.id, parsed.data.isActive);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo actualizar" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await authorize();
  if (auth.error) return forbidden();

  try {
    await promotionsService.remove(auth.companyId, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo eliminar" }, { status: 400 });
  }
}
