import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attendanceService } from "@/modules/attendance/service";
import { attendanceGuard } from "@/modules/attendance/guard";
import { parseFilters } from "@/modules/attendance/filters";

/**
 * GET /api/attendance/export?type=summary|records&from=AAAA-MM-DD&to=AAAA-MM-DD[&employeeId=&branchId=]
 *  - summary: horas, retardos, faltas y horas extra por empleado (para nómina).
 *  - records: todas las marcas con fecha, hora, origen y hash (para entregar a la autoridad).
 */
export async function GET(req: Request) {
  const g = await attendanceGuard("manage");
  if (g.error) return g.error;
  const url = new URL(req.url);
  const filters = parseFilters(url);
  if ("error" in filters) return NextResponse.json({ error: filters.error }, { status: 400 });
  const type = url.searchParams.get("type") === "records" ? "records" : "summary";

  const csv =
    type === "records"
      ? await attendanceService.exportRecordsCsv(g.companyId, filters)
      : await attendanceService.exportSummaryCsv(g.companyId, filters);

  await prisma.auditLog.create({
    data: {
      companyId: g.companyId,
      userId: g.ctx.userId,
      action: "DATA_EXPORT",
      entity: "Export",
      entityId: `attendance_${type}`,
      newData: { type, from: filters.from, to: filters.to },
    },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="checador-${type === "records" ? "registros" : "resumen"}-${filters.from}-a-${filters.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
