import { Doc, wa } from "@/components/site-shell";

export const metadata = { title: "Sobre nosotros — Tappy" };

export default function Nosotros() {
  return (
    <Doc title="Sobre nosotros">
      <p>Tappy nació en Monterrey para que los negocios de comida en México operen con herramientas claras, sin depender de hojas de cálculo ni de sistemas pensados para otros países.</p>
      <h2>Lo que creemos</h2>
      <p>Que cada negocio es distinto. Por eso Tappy se configura a tu medida: tu marca, tus módulos, tu equipo y tu forma de cobrar.</p>
      <h2>Cómo trabajamos</h2>
      <p>Construimos con restaurantes reales y escuchamos lo que necesitan. Nuestro soporte es directo, por WhatsApp y correo, con personas que conocen tu operación.</p>
      <p style={{ marginTop: 28 }}><a className="tp-btn" href={wa("Quiero agendar una demo")}>Agendar demo</a></p>
    </Doc>
  );
}
