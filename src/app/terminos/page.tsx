import { Doc, EMAIL } from "@/components/site-shell";

export const metadata = { title: "Términos y condiciones — Tappy" };

export default function Terminos() {
  return (
    <Doc title="Términos y condiciones" updated="noviembre de 2026">
      <p>Al usar Tappy aceptas estos términos. Si no estás de acuerdo, no uses la plataforma.</p>
      <h2>El servicio</h2>
      <p>Tappy es una plataforma en la nube por suscripción para operar ventas, inventario, reportes y otras funciones de tu negocio. Las funciones disponibles dependen del plan o de la configuración personalizada que contrates.</p>
      <h2>Cuenta y uso</h2>
      <p>Eres responsable de la información que captures, de los accesos de tu equipo y de mantener tus credenciales en secreto. No puedes usar Tappy para fines ilegales ni intentar vulnerar su seguridad.</p>
      <h2>Precios y pagos</h2>
      <p>Los precios se muestran en pesos mexicanos por mes, ya incluyen el IVA e incluyen lo descrito en cada plan. Tappy no cobra comisión sobre tus ventas; los procesadores de pago pueden cobrar sus propias comisiones. Si la suscripción no se paga, el acceso puede suspenderse tras el periodo de gracia.</p>
      <h2>Cancelación</h2>
      <p>Puedes cancelar tu suscripción cuando quieras, salvo que tengas un financiamiento de equipo pendiente, que se rige por su propio acuerdo. Puedes solicitar la exportación de tu información antes de cancelar.</p>
      <h2>Disponibilidad y responsabilidad</h2>
      <p>Trabajamos para que el servicio esté siempre disponible, pero pueden existir interrupciones por mantenimiento o por terceros. Tappy no será responsable por pérdidas indirectas derivadas del uso del servicio.</p>
      <h2>Contacto</h2>
      <p>Dudas sobre estos términos: <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>
    </Doc>
  );
}
