import { NextResponse } from "next/server";
import { attendanceService, settingsSchema } from "@/modules/attendance/service";
import { attendanceGuard, errorResponse } from "@/modules/attendance/guard";

export async function GET() {
  const g = await attendanceGuard("manage");
  if (g.error) return g.error;
  return NextResponse.json({ settings: await attendanceService.getSettings(g.companyId) });
}

export async function PUT(req: Request) {
  const g = await attendanceGuard("manage");
  if (g.error) return g.error;
  const parsed = settingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  try {
    return NextResponse.json({ settings: await attendanceService.updateSettings(g.companyId, parsed.data) });
  } catch (err) {
    return errorResponse(err, "No se pudo guardar la configuración");
  }
}
