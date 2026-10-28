import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card } from "@/components/ui";
import { getSupportContact } from "@/lib/support-contact";

export default async function SupportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) redirect("/login");

  const contact = getSupportContact();
  const subject = encodeURIComponent("Necesito apoyo con Tappy");

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-semibold mb-1">¿Necesitas apoyo?</h1>
      <p className="text-muted text-sm mb-8">
        Contacta a nuestro personal de soporte. Cuéntanos qué pasó y, si puedes, en qué pantalla estabas.
      </p>

      <div className="grid gap-4">
        {contact.whatsappHref && (
          <Card className="p-5">
            <p className="font-medium mb-1">WhatsApp</p>
            <p className="text-muted text-sm mb-3">La forma más rápida de recibir ayuda.</p>
            <a
              href={contact.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-md bg-ember text-white px-4 py-2 text-sm font-medium"
            >
              Escribir por WhatsApp
            </a>
          </Card>
        )}

        {contact.phone && contact.phoneHref && (
          <Card className="p-5">
            <p className="font-medium mb-1">Teléfono</p>
            <a href={contact.phoneHref} className="font-mono text-lg underline">
              {contact.phone}
            </a>
          </Card>
        )}

        <Card className="p-5">
          <p className="font-medium mb-1">Correo de soporte</p>
          <a href={`mailto:${contact.email}?subject=${subject}`} className="underline">
            {contact.email}
          </a>
        </Card>

        {contact.hours && <p className="text-muted text-sm">Horario de atención: {contact.hours}</p>}
      </div>
    </div>
  );
}
