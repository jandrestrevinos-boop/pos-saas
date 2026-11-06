import { NextResponse } from "next/server";
import { attendanceService, employeeUpdateSchema } from "@/modules/attendance/service";
import { attendanceGuard, errorResponse } from "@/modules/attendance/guard";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await attendanceGuard("manage");
  if (g.error) return g.error;
  const parsed = employeeUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  try {
    await attendanceService.updateEmployee(g.companyId, params.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "No se pudo guardar el empleado");
  }
}
