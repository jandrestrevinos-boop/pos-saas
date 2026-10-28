/**
 * Datos de contacto del soporte de Tappy que ven los restaurantes.
 * Se configuran con variables de entorno en Vercel (sin tocar código):
 *   SUPPORT_EMAIL     correo de soporte (default: contacto@tappysoftware.com)
 *   SUPPORT_PHONE     teléfono de soporte, ej. "+52 81 1234 5678"
 *   SUPPORT_WHATSAPP  número de WhatsApp solo dígitos con lada, ej. "5218112345678"
 *                     (si no se define, se usa SUPPORT_PHONE)
 *   SUPPORT_HOURS     horario de atención (texto libre)
 */
export function getSupportContact() {
  const email = process.env.SUPPORT_EMAIL?.trim() || "contacto@tappysoftware.com";
  const phone = process.env.SUPPORT_PHONE?.trim() || null;
  const whatsappDigits = (process.env.SUPPORT_WHATSAPP?.trim() || phone || "").replace(/\D/g, "");
  const hours = process.env.SUPPORT_HOURS?.trim() || null;
  return {
    email,
    phone,
    phoneHref: phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null,
    whatsappHref: whatsappDigits ? `https://wa.me/${whatsappDigits}` : null,
    hours,
  };
}
