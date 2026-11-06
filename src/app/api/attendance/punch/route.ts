import { NextResponse } from "next/server";
import { getTenantContext, resolveBranchId } from "@/lib/tenant-context";
import { rateLimit } from "@/lib/rate-limit";
import { attendanceService, type PunchPhoto } from "@/modules/attendance/service";
import { attendanceGuard, errorResponse } from "@/modules/attendance/guard";

export const runtime = "nodejs";

const MAX_PHOTO_BYTES = 800 * 1024; // el navegador ya la reduce; esto es el tope duro

/** Tipo real de la imagen por sus primeros bytes (no confiamos en lo que declare el navegador). */
function sniff(buf: Buffer): PunchPhoto | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { buf, type: "image/jpeg", ext: "jpg" };
  if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return { buf, type: "image/webp", ext: "webp" };
  }
  return null;
}

/**
 * POST multipart/form-data (quiosco): code, pin, acceptConsent ("1"), photo.
 * El servidor decide si es entrada o salida y pone la hora; el navegador nunca manda la hora.
 */
export async function POST(req: Request) {
  const g = await attendanceGuard("kiosk");
  if (g.error) return g.error;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!rateLimit(`punch:${g.companyId}:${ip ?? "?"}`, 40, 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un momento." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer la solicitud" }, { status: 400 });
  }

  const code = Number(form.get("code"));
  const pin = String(form.get("pin") ?? "");
  if (!Number.isInteger(code) || code < 1 || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "Número de empleado o PIN incorrecto" }, { status: 400 });
  }

  let photo: PunchPhoto | null = null;
  const file = form.get("photo");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: "La foto es muy pesada" }, { status: 400 });
    photo = sniff(Buffer.from(await file.arrayBuffer()));
    if (!photo) return NextResponse.json({ error: "Formato de foto no soportado" }, { status: 400 });
  }

  try {
    const ctx = await getTenantContext();
    const branchId = await resolveBranchId(ctx, g.companyId);
    if (!branchId) throw new Error("La empresa no tiene sucursales activas");
    const result = await attendanceService.punch({
      companyId: g.companyId,
      deviceUserId: g.ctx.userId,
      branchId,
      ip,
      code,
      pin,
      acceptConsent: form.get("acceptConsent") === "1",
      photo,
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "No se pudo registrar la marca");
  }
}
