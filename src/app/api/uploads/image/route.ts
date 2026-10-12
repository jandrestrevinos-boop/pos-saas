import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024; // el navegador ya comprime; esto es solo el tope duro

/** Detecta el tipo real por los primeros bytes (no confiamos en la extensión ni en el tipo declarado). */
function sniff(buf: Buffer): { type: string; ext: string } | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { type: "image/png", ext: "png" };
  }
  if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return { type: "image/webp", ext: "webp" };
  }
  return null;
}

/** multipart/form-data: `file` y `kind` = "logo" | "product". Devuelve { url }. */
export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer la imagen. Intenta de nuevo." }, { status: 400 });
  }

  const kind = form.get("kind") === "logo" ? "logo" : "product";
  const needed = kind === "logo" ? PERMISSIONS.SETTINGS_MANAGE : PERMISSIONS.PRODUCTS_MANAGE;
  if (!hasPermission(ctx.permissions, needed)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecciona una imagen" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen es muy pesada (máximo 2 MB)." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const kindInfo = sniff(buf);
  if (!kindInfo) {
    return NextResponse.json({ error: "Formato no soportado. Usa una imagen JPG, PNG o WebP." }, { status: 400 });
  }

  const pathname = kind === "logo" ? `${companyId}/logo.${kindInfo.ext}` : `${companyId}/products/foto.${kindInfo.ext}`;
  try {
    const blob = await put(pathname, buf, { access: "public", addRandomSuffix: true, contentType: kindInfo.type });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    console.error("Error subiendo imagen a Blob", e);
    return NextResponse.json(
      { error: "No se pudo guardar la imagen. Verifica que el almacenamiento (Vercel Blob) esté conectado al proyecto." },
      { status: 500 }
    );
  }
}
