import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { parseTable } from "@/modules/import/parse";
import { previewSalesImport, commitSalesImport } from "@/modules/import/sales-import";
import { buildSalesTemplate } from "@/modules/import/template";

export const runtime = "nodejs";
export const maxDuration = 60;

// Importar historial es información financiera: mismo permiso que ver reportes (Administrador/Gerente).
const FORBIDDEN = { error: "No tienes permiso para esta acción" };

/** Descarga la plantilla de Excel de ventas. */
export async function GET() {
  const ctx = await getTenantContext();
  requireCompanyId(ctx);
  if (!hasPermission(ctx.permissions, PERMISSIONS.REPORTS_VIEW)) {
    return NextResponse.json(FORBIDDEN, { status: 403 });
  }
  const buf = await buildSalesTemplate();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Tappy_plantilla_ventas.xlsx"',
    },
  });
}

/** multipart/form-data: `file` (.xlsx o .csv) y `mode` = "preview" | "commit". */
export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);
  if (!hasPermission(ctx.permissions, PERMISSIONS.REPORTS_VIEW)) {
    return NextResponse.json(FORBIDDEN, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el archivo. Intenta de nuevo." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecciona un archivo .xlsx o .csv" }, { status: 400 });
  }
  const mode = form.get("mode") === "commit" ? "commit" : "preview";

  try {
    const rows = await parseTable(Buffer.from(await file.arrayBuffer()), file.name, "Ventas");
    const branchId = await resolveBranchId(ctx, companyId);

    if (mode === "preview") {
      return NextResponse.json(await previewSalesImport(companyId, rows, branchId));
    }
    return NextResponse.json(await commitSalesImport(companyId, rows, { branchId, userId: ctx.userId }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo procesar el archivo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
