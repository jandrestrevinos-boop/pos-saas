"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { inputClass } from "@/components/ui/modal";
import { formatMxn } from "@/lib/format";

type Overview = {
  companyName: string;
  companyStatus: "ACTIVE" | "SUSPENDED" | "CANCELLED";
  planName: string | null;
  priceMxn: number | null;
  hasRecurringCharge: boolean;
  access: {
    state: "DEMO" | "ACTIVE" | "GRACE" | "BLOCKED";
    allowed: boolean;
    endsAt: string | null;
    graceEndsAt: string | null;
    daysLeft: number | null;
    graceDaysLeft: number | null;
    blockReason: "COMPANY_INACTIVE" | "CANCELED" | "EXPIRED" | null;
  };
  payments: {
    id: string;
    amountMxn: number;
    status: string;
    method: "MERCADOPAGO" | "MANUAL";
    paidAt: string | null;
    periodEnd: string | null;
    note: string | null;
  }[];
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export function FacturacionClient({ overview, canPay }: { overview: Overview; canPay: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returning = searchParams.get("retorno") === "1";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [polls, setPolls] = useState(0);

  const { access } = overview;
  const inactive = access.blockReason === "COMPANY_INACTIVE" || access.blockReason === "CANCELED";

  // Al volver de Mercado Pago el aviso (webhook) puede tardar unos segundos:
  // refrescamos solos hasta ~1 minuto para que el acceso se reactive sin que
  // el cliente tenga que hacer nada.
  useEffect(() => {
    if (!returning || access.state === "ACTIVE" || polls >= 12) return;
    const t = setTimeout(() => {
      router.refresh();
      setPolls((n) => n + 1);
    }, 5000);
    return () => clearTimeout(t);
  }, [returning, access.state, polls, router]);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payerEmail: email }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "No se pudo generar el link de pago");
      return;
    }
    window.location.href = data.checkoutUrl;
  }

  let headline = "";
  let detail = "";
  if (access.state === "DEMO") {
    headline = "Estás en periodo de demo";
    detail = access.endsAt
      ? `Tu demo termina el ${fmtDate(access.endsAt)}. Si te suscribes desde hoy, el primer cobro se hace hasta ese día.`
      : "Tu demo no tiene fecha de término todavía.";
  } else if (access.state === "ACTIVE") {
    headline = "Tu plan está al corriente";
    detail = access.endsAt ? `Pagado hasta el ${fmtDate(access.endsAt)}.` : "Tu plan está activo.";
  } else if (access.state === "GRACE") {
    headline = "Tu plan venció";
    detail = `Todavía puedes operar ${access.graceDaysLeft} ${access.graceDaysLeft === 1 ? "día" : "días"} más. Regulariza tu pago para no perder el acceso.`;
  } else if (inactive) {
    headline = access.blockReason === "CANCELED" ? "Tu suscripción fue cancelada" : "Tu cuenta está suspendida";
    detail = "Para reactivarla, contacta a soporte de Tappy.";
  } else {
    headline = "Tu periodo terminó";
    detail = "Para seguir usando Tappy, contrata tu plan. Tu información sigue guardada: en cuanto el pago se confirme, vuelves a entrar.";
  }

  const showPay = canPay && !inactive;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <p className="font-display text-xl font-semibold">{overview.companyName}</p>
        <Button variant="ghost" onClick={() => signOut({ callbackUrl: "/login" })}>
          Cerrar sesión
        </Button>
      </div>

      <Card className="p-6 mb-6">
        <p className="font-display text-2xl font-semibold mb-1">{headline}</p>
        <p className="text-sm text-muted mb-4">{detail}</p>

        {overview.planName && (
          <p className="text-sm mb-4">
            Plan <strong>{overview.planName}</strong>
            {overview.priceMxn !== null && <> · <span className="font-mono">{formatMxn(overview.priceMxn)}</span> al mes</>}
          </p>
        )}

        {returning && access.state !== "ACTIVE" && polls < 12 && (
          <p className="text-sm rounded-md bg-marigold/10 border border-marigold/30 px-3 py-2 mb-4">
            Estamos confirmando tu pago con Mercado Pago… esta pantalla se actualiza sola.
          </p>
        )}
        {returning && access.state === "ACTIVE" && (
          <p className="text-sm rounded-md bg-sage/10 border border-sage/30 px-3 py-2 mb-4">
            ¡Pago confirmado! Ya puedes seguir usando Tappy.
          </p>
        )}

        {access.allowed && (
          <Link href="/redirect-after-login" className="inline-block text-sm underline mb-4">
            Volver a la plataforma
          </Link>
        )}

        {!canPay && !inactive && access.state !== "ACTIVE" && (
          <p className="text-sm text-muted">Pídele al administrador de tu empresa que realice el pago.</p>
        )}

        {showPay && access.state !== "ACTIVE" && (
          <form onSubmit={pay} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Correo de tu cuenta de Mercado Pago</label>
              <input
                type="email"
                required
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
              />
            </div>
            {error && <p className="text-sm text-ember-dark">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? "Redirigiendo…" : access.state === "DEMO" ? "Suscribirme con Mercado Pago" : "Pagar con Mercado Pago"}
            </Button>
            <p className="text-xs text-muted">
              Autorizas un cargo mensual automático que puedes cancelar en tu cuenta de Mercado Pago.
            </p>
          </form>
        )}

        {overview.hasRecurringCharge && access.state === "ACTIVE" && (
          <p className="text-xs text-muted">Tu cobro mensual automático está configurado.</p>
        )}
      </Card>

      {overview.payments.length > 0 && (
        <Card className="overflow-hidden">
          <p className="px-5 py-3 text-xs uppercase tracking-wide text-muted border-b border-line">Historial de pagos</p>
          <table className="w-full text-sm">
            <tbody>
              {overview.payments.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">{fmtDate(p.paidAt)}</td>
                  <td className="px-5 py-3 font-mono">{formatMxn(p.amountMxn)}</td>
                  <td className="px-5 py-3 text-muted">{p.method === "MANUAL" ? "Pago manual" : "Mercado Pago"}</td>
                  <td className="px-5 py-3 text-muted">hasta {fmtDate(p.periodEnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
