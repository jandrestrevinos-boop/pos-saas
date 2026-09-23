import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-gating";
import { FEATURE_KEYS } from "@/lib/plan-features";
import { mercadoPagoService } from "@/modules/mercadoPago/service";
import { configService as whatsappConfigService } from "@/modules/whatsapp/configService";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  if (!hasPermission(session.user.permissions, PERMISSIONS.SETTINGS_MANAGE)) {
    redirect("/dashboard");
  }

  const pagosIntegradosEnabled = await hasFeature(session.user.companyId, FEATURE_KEYS.PAGOS_INTEGRADOS);
  const mpAccount = pagosIntegradosEnabled ? await mercadoPagoService.getAccount(session.user.companyId) : null;

  const whatsappEnabled = await hasFeature(session.user.companyId, FEATURE_KEYS.WHATSAPP_BUSINESS);
  const waConfig = whatsappEnabled ? await whatsappConfigService.getConfig(session.user.companyId) : null;

  return (
    <Suspense fallback={<div className="p-8 text-muted text-sm">Cargando...</div>}>
      <SettingsClient
        pagosIntegradosEnabled={pagosIntegradosEnabled}
        mercadoPagoConnected={!!mpAccount}
        mercadoPagoLiveMode={mpAccount?.liveMode ?? null}
        whatsappEnabled={whatsappEnabled}
        whatsappConnected={!!waConfig?.isEnabled}
        whatsappPhoneNumberId={waConfig?.phoneNumberId ?? ""}
        whatsappWelcomeMessage={waConfig?.welcomeMessage ?? "Hola! Bienvenido a nuestro restaurante"}
      />
    </Suspense>
  );
}
