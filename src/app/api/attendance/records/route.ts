import { NextResponse } from "next/server";
import { attendanceService } from "@/modules/attendance/service";
import { attendanceGuard, errorResponse } from "@/modules/attendance/guard";
import { manualRecordSchema, parseFilters } from "@/modules/attendance/filters";

export async function GET(req: Request) {
  const g = await attendanceGuard("manage");
  if (g.error) return g.error;
  const filters = parseFilters(new URL(req.url));
  if ("error" in filters) return NextResponse.json({ error: filters.error }, { status: 400 });
  const records = await attendanceService.listRecords(g.companyId, filters);
  return NextResponse.json({ records });
}

/** Marca olvidada capturada por un gerente/administrador (siempre con motivo). */
export async function POST(req: Request) {
  const g = await attendanceGuard("manage");
  if (g.error) return g.error;
  const parsed = manualRecordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  try {
    await attendanceService.addManual(g.companyId, g.ctx.userId, parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return errorResponse(err, "No se pudo capturar la marca");
  }
}
