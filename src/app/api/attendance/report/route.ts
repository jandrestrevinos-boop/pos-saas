import { NextResponse } from "next/server";
import { attendanceService } from "@/modules/attendance/service";
import { attendanceGuard } from "@/modules/attendance/guard";
import { parseFilters } from "@/modules/attendance/filters";

export async function GET(req: Request) {
  const g = await attendanceGuard("manage");
  if (g.error) return g.error;
  const filters = parseFilters(new URL(req.url));
  if ("error" in filters) return NextResponse.json({ error: filters.error }, { status: 400 });
  return NextResponse.json(await attendanceService.report(g.companyId, filters));
}
