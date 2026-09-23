import { NextResponse } from "next/server";
import { getTenantContext, requireCompanyId } from "@/lib/tenant-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { configService } from "@/modules/whatsapp/configService";

export async function GET() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.SETTINGS_MANAGE)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const config = await configService.getConfig(companyId);

  // Nunca regresamos el accessToken al cliente — solo lo que se necesita
  // para mostrar el estado y prellenar el formulario.
  return NextResponse.json({
    connected: !!config?.isEnabled,
    phoneNumberId: config?.phoneNumberId ?? "",
    welcomeMessage: config?.welcomeMessage ?? "Hola! Bienvenido a nuestro restaurante",
  });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.SETTINGS_MANAGE)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const whatsappEnabled = await hasFeature(companyId, FEATURE_KEYS.WHATSAPP_BUSINESS);
  if (!whatsappEnabled) {
    return NextResponse.json(
      { error: "WhatsApp Business no está incluido en tu plan actual" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const phoneNumberId = String(body.phoneNumberId ?? "").trim();
  const accessToken = body.accessToken ? String(body.accessToken).trim() : undefined;
  const welcomeMessage = body.welcomeMessage ? String(body.welcomeMessage).trim() : undefined;

  if (!phoneNumberId) {
    return NextResponse.json({ error: "El Phone Number ID es obligatorio" }, { status: 400 });
  }

  const existing = await configService.getConfig(companyId);
  if (!existing && !accessToken) {
    return NextResponse.json(
      { error: "El token de acceso es obligatorio la primera vez que conectas" },
      { status: 400 }
    );
  }

  await configService.upsertConfig(companyId, { phoneNumberId, accessToken, welcomeMessage });

  return NextResponse.json({ connected: true });
}

export async function DELETE() {
  const ctx = await getTenantContext();
  const companyId = requireCompanyId(ctx);

  if (!hasPermission(ctx.permissions, PERMISSIONS.SETTINGS_MANAGE)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await configService.disconnect(companyId);

  return NextResponse.json({ connected: false });
}
