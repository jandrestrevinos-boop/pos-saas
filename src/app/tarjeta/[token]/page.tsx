import type { Metadata } from "next";
import { loyaltyService } from "@/modules/loyalty/service";
import { QrImage } from "@/components/loyalty/qr-image";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi tarjeta de cliente frecuente", robots: { index: false, follow: false } };

export default async function TarjetaPage({ params }: { params: { token: string } }) {
  const card = await loyaltyService.getCard(params.token);

  if (!card) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-paper px-6">
        <div className="text-center max-w-sm">
          <p className="font-display text-2xl font-semibold mb-2">Tarjeta no disponible</p>
          <p className="text-muted text-sm">No encontramos esta tarjeta. Pide ayuda en el mostrador.</p>
        </div>
      </main>
    );
  }

  const shown = Math.min(card.visits, card.required);

  return (
    <main className="min-h-screen bg-paper flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-ink-950 text-white rounded-2xl p-6 shadow-xl">
          <p className="text-xs uppercase tracking-wide text-white/50">Clientes frecuentes</p>
          <h1 className="font-display text-2xl font-semibold mt-1">{card.restaurantName}</h1>
          <p className="text-sm text-white/70 mt-1">{card.name}</p>

          <div className="bg-white rounded-xl p-4 mt-5 flex flex-col items-center">
            <QrImage path={`/tarjeta/${params.token}`} size={208} />
            {card.shortCode && (
              <p className="text-[11px] text-muted mt-2">
                Código: <span className="font-mono tracking-widest text-ink">{card.shortCode}</span>
              </p>
            )}
          </div>

          <p className="text-xs text-white/60 mt-5 mb-2">
            {card.visits} de {card.required} visitas
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: card.required }).map((_, i) => (
              <span
                key={i}
                className={`h-5 w-5 rounded-full border ${i < shown ? "bg-marigold border-marigold" : "border-white/30"}`}
              />
            ))}
          </div>
        </div>

        {card.rewardAvailable ? (
          <p className="mt-5 text-center text-sm font-medium bg-sage-light text-sage rounded-lg px-4 py-3">
            ¡Tienes {card.discountText}! Muestra esta tarjeta al pagar.
          </p>
        ) : (
          <p className="mt-5 text-center text-xs text-muted">
            Muestra este código en cada visita. Al llegar a {card.required} visitas obtienes {card.discountText}.
          </p>
        )}
        {!card.programActive && (
          <p className="mt-3 text-center text-xs text-muted">El programa está pausado por el momento.</p>
        )}
        <p className="mt-6 text-center text-[11px] text-muted">
          Tip: guarda esta página en tu pantalla de inicio para tenerla siempre a la mano.
        </p>
      </div>
    </main>
  );
}
