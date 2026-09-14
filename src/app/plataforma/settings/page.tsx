import { platformSettingsService } from "@/modules/platformSettings/service";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const settings = await platformSettingsService.get();

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Configuración</h1>
      <p className="text-muted text-sm mb-8">Reglas comerciales de la plataforma.</p>
      <SettingsClient initialSettings={JSON.parse(JSON.stringify(settings))} />
    </div>
  );
}
