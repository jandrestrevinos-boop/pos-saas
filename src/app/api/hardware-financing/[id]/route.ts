import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { hardwareFinancingService } from "@/modules/hardwareFinancing/service";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const financing = await hardwareFinancingService.get(params.id);
    return NextResponse.json({ financing });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No encontrado";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
