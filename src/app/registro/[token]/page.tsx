import type { Metadata } from "next";
import { loyaltyService } from "@/modules/loyalty/service";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Únete al programa de clientes frecuentes", robots: { index: false, follow: false } };

export default async function RegistroPage({ params }: { params: { token: string } }) {
  const info = await loyaltyService.getSignupInfo(params.token);

  if (!info) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-paper px-6">
        <div className="text-center max-w-sm">
          <p className="font-display text-2xl font-semibold mb-2">Programa no disponible</p>
          <p className="text-muted text-sm">Este código QR ya no está activo. Pregunta en el mostrador por el vigente.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <p className="text-xs uppercase tracking-wide text-muted mb-2">Clientes frecuentes</p>
        <h1 className="font-display text-3xl font-semibold mb-2">{info.restaurantName}</h1>
        <p className="text-sm text-muted mb-6">
          Registra tu tarjeta digital. Después de <strong className="text-ink">{info.visitsRequired} visitas</strong> con
          compra, obtienes <strong className="text-ink">{info.discountText}</strong>.
        </p>
        <RegisterForm signupToken={params.token} restaurantName={info.restaurantName} />
      </div>
    </main>
  );
}
