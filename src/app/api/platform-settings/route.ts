import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { platformSettingsService } from "@/modules/platformSettings/service";
import { z } from "zod";

const updateSchema = z.object({
  blockCancellationWithPendingFinancing: z.boolean().optional(),
  defaultTrialDays: z.coerce.number().int().min(1).max(365).optional(),
  graceDays: z.coerce.number().int().min(0).max(60).optional(),
});

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const settings = await platformSettingsService.get();
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const settings = await platformSettingsService.update(parsed.data);
  return NextResponse.json({ settings });
}
