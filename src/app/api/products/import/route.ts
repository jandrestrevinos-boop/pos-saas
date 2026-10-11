import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId, resolveBranchId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { parseTable } from "@/modules/import/parse";
import { previewProductsImport, commitProductsImport } from "@/modules/import/products-import";
import { buildProductsTemplate } from "@/modules/import/template";

export const runtime = "nodejs";
export const maxDuration = 60; // importar cientos de productos puede tardar más que el límite por defecto

/** Descarga la plantilla de Excel. */
export async function GET() {
  const ctx = await getTenantContext();
  requireCompanyId(ctx);
  if (!hasPermission(ctx.permissions, PERMISSIONS.PRODUCTS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  const buf = await buildProductsTemplate();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Tappy_plantilla_productos.xlsx"',
    },
  });
}

/**
 * multipart/form-data con `file` (.xlsx o .csv) y `mode`:
 *  - "preview": solo analiza, no escribe nada.
 *  - "commit": importa las filas válidas.
 */
export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.PRODUCTS_MANAGE)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
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
    const rows = await parseTable(Buffer.from(await file.arrayBuffer()), file.name, "Productos");

    if (mode === "preview") {
      const preview = await previewProductsImport(companyId, rows);
      return NextResponse.json(preview);
    }

    const branchId = await resolveBranchId(ctx, companyId);
    const result = await commitProductsImport(companyId, rows, { branchId, userId: ctx.userId });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo procesar el archivo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
