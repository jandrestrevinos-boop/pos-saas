import { NextResponse } from "next/server";
import { attendanceService } from "@/modules/attendance/service";
import { attendanceGuard, errorResponse } from "@/modules/attendance/guard";
import { voidSchema } from "@/modules/attendance/filters";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await attendanceGuard("manage");
  if (g.error) return g.error;
  const parsed = voidSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  try {
    await attendanceService.voidRecord(g.companyId, g.ctx.userId, params.id, parsed.data.reason);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "No se pudo anular la marca");
  }
}
