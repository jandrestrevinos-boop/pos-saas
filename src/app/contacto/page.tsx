import { Doc, EMAIL, wa } from "@/components/site-shell";

export const metadata = { title: "Contacto — Tappy" };

export default function Contacto() {
  return (
    <Doc title="Contacto">
      <p>Escríbenos para agendar una demo, resolver dudas o armar un plan a la medida de tu negocio.</p>
      <h2>WhatsApp</h2>
      <p><a href={wa("Hola, quiero información de Tappy")} style={{ color: "var(--ember)", fontWeight: 600 }}>+52 1 81 2355 7288</a></p>
      <h2>Correo</h2>
      <p><a href={`mailto:${EMAIL}`} style={{ color: "var(--ember)", fontWeight: 600 }}>{EMAIL}</a></p>
      <h2>¿Ya eres cliente y necesitas apoyo?</h2>
      <p>Escríbenos por WhatsApp o correo con el nombre de tu negocio y te ayudamos.</p>
      <p style={{ marginTop: 28 }}><a className="tp-btn" href={wa("Quiero agendar una demo")}>Agendar demo</a></p>
    </Doc>
  );
}
