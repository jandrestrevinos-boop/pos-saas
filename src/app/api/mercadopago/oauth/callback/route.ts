import { NextResponse } from "next/server";
import { mercadoPagoService } from "@/modules/mercadoPago/service";

/**
 * Mercado Pago redirige aquí después de que el dueño del restaurante
 * autoriza la conexión. `state` es el companyId que mandamos nosotros en
 * getAuthorizeUrl() — solo alguien con el link que nosotros generamos (ya
 * autenticado como ADMIN_EMPRESA de esa empresa) pudo haber llegado aquí
 * con ese state, así que no requiere sesión activa para completarse.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const companyId = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const redirectBase = "/settings?tab=integraciones";

  if (errorParam || !code || !companyId) {
    return NextResponse.redirect(new URL(`${redirectBase}&mp=error`, url.origin));
  }

  try {
    const token = await mercadoPagoService.exchangeCodeForToken(code);
    await mercadoPagoService.saveAccount(companyId, token);
    return NextResponse.redirect(new URL(`${redirectBase}&mp=conectado`, url.origin));
  } catch {
    return NextResponse.redirect(new URL(`${redirectBase}&mp=error`, url.origin));
  }
}
