import { Doc, EMAIL } from "@/components/site-shell";

export const metadata = { title: "Aviso de privacidad — Tappy" };

export default function Privacidad() {
  return (
    <Doc title="Aviso de privacidad" updated="noviembre de 2026">
      <p>En Tappy (tappysoftware.com) cuidamos tus datos personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.</p>
      <h2>Datos que recabamos</h2>
      <p>Nombre, correo electrónico, teléfono, nombre del negocio y datos de uso de la plataforma. Los datos de los clientes finales de cada negocio (por ejemplo, su programa de clientes frecuentes) los captura y administra el propio negocio.</p>
      <h2>Para qué los usamos</h2>
      <ul>
        <li>Crear y administrar tu cuenta y prestarte el servicio contratado.</li>
        <li>Cobrar tu suscripción y enviarte avisos de tu cuenta.</li>
        <li>Darte soporte y mejorar la plataforma.</li>
        <li>Contactarte sobre demos, planes y novedades, si lo solicitaste.</li>
      </ul>
      <h2>Con quién los compartimos</h2>
      <p>Solo con proveedores necesarios para operar el servicio, como alojamiento en la nube, procesadores de pago y mensajería de WhatsApp, y con autoridades cuando la ley lo exija. No vendemos tus datos.</p>
      <h2>Tus derechos</h2>
      <p>Puedes acceder, rectificar o cancelar tus datos, oponerte a su uso o revocar tu consentimiento escribiendo a <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. Responderemos a tu solicitud en los plazos que marca la ley.</p>
      <h2>Seguridad</h2>
      <p>Aplicamos medidas técnicas y administrativas para proteger tu información, como acceso por roles, conexiones cifradas y respaldos.</p>
      <h2>Cambios a este aviso</h2>
      <p>Publicaremos cualquier cambio en esta página.</p>
    </Doc>
  );
}
