import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { loyaltyService, enrollSchema } from "@/modules/loyalty/service";

/**
 * Registro PÚBLICO (sin sesión): el cliente escanea el QR fijo del mostrador, deja nombre y
 * celular y recibe su tarjeta. Solo crea la tarjeta; nunca suma visitas.
 */
const schema = enrollSchema.extend({
  signupToken: z.string().min(10).max(100),
  acceptedPrivacy: z.literal(true, { errorMap: () => ({ message: "Debes aceptar el aviso de privacidad" }) }),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // 8 registros por hora por IP y 60 por hora por QR: frena el spam sin molestar a un restaurante lleno.
  if (!rateLimit(`loyalty-reg-ip:${ip}`, 8, 60 * 60 * 1000) || !rateLimit(`loyalty-reg-token:${parsed.data.signupToken}`, 60, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiados intentos. Intenta de nuevo más tarde." }, { status: 429 });
  }

  try {
    const result = await loyaltyService.registerPublic(parsed.data.signupToken, {
      name: parsed.data.name,
      phone: parsed.data.phone,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo completar el registro" }, { status: 400 });
  }
}
