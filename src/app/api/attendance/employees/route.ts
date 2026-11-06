import { NextResponse } from "next/server";
import { attendanceService, employeeCreateSchema } from "@/modules/attendance/service";
import { attendanceGuard, errorResponse } from "@/modules/attendance/guard";

export async function GET() {
  const g = await attendanceGuard("manage");
  if (g.error) return g.error;
  return NextResponse.json({ employees: await attendanceService.listEmployees(g.companyId) });
}

export async function POST(req: Request) {
  const g = await attendanceGuard("manage");
  if (g.error) return g.error;
  const parsed = employeeCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  try {
    return NextResponse.json(await attendanceService.createEmployee(g.companyId, parsed.data), { status: 201 });
  } catch (err) {
    return errorResponse(err, "No se pudo crear el empleado");
  }
}
