import { SiteShell, wa } from "@/components/site-shell";

const funciones = [
  ["Punto de venta", "Caja de mostrador y mesas con cuenta abierta: acumula rondas y cobra al final."],
  ["Cocina en pantalla", "Las comandas llegan a una TV, tablet o computadora, sin impresora térmica."],
  ["Pedidos por WhatsApp", "Tus clientes piden por WhatsApp y el pedido entra solo a cocina."],
  ["Cobro con tarjeta", "Terminal de Mercado Pago, link de pago o la terminal que ya usas."],
  ["Inventario", "Existencias por sucursal, alertas de reposición e historial de movimientos."],
  ["Reportes y corte de caja", "Ventas en vivo, corte X y Z, auditoría de cajas y dashboard con gráficas."],
  ["Clientes frecuentes", "Tarjeta digital con QR: después de cierto número de visitas, tu cliente gana su recompensa."],
  ["Promociones y cupones", "Descuentos por producto o ticket, 2x1, happy hour y cupones con código."],
  ["Multi-sucursal", "Varias sucursales, cada una con su inventario, su equipo y su dashboard."],
  ["Roles y permisos", "Administrador, gerente, cajero, mesero y cocina: cada quien ve solo lo suyo."],
  ["Importación de datos", "Trae tus productos y tu historial de ventas desde otras plataformas, sin capturarlos uno por uno."],
  ["Desde cualquier dispositivo", "Funciona en celular, tablet y computadora."],
];

const medida = [
  ["Tu marca", "Sube tu logo y elige colores y tipografías. Decide si tus productos llevan foto."],
  ["Solo los módulos que usas", "Activa por negocio WhatsApp, clientes frecuentes, mesas, costeo por receta o promociones."],
  ["Tu equipo", "Permisos por usuario y asientos extra por sucursal, según el tamaño de tu operación."],
  ["Tu tipo de negocio", "Restaurante, cafetería, taquería, bar: los roles y la estructura se ajustan (en cafetería, tu cocinero es el barista)."],
  ["Tus datos", "Migra productos y ventas desde tu sistema anterior y empieza con tu información."],
  ["Tu forma de cobrar", "Usa tu terminal actual y decide si pides referencia en pagos con tarjeta y transferencia."],
];

const tipos = [
  ["Restaurante", "Ventas, mesas, cocina e inventario en un solo lugar."],
  ["Cafetería", "Pedidos rápidos, barra y control de productos."],
  ["Taquería", "Registra ventas al momento y controla tus productos."],
  ["Comida rápida", "Menos tiempo de atención, más control de tus ventas."],
  ["Bar", "Productos, cuentas abiertas e inventario."],
  ["Restaurante pequeño", "Empieza con lo necesario y crece cuando lo necesites."],
];

const base = [
  "Inventario avanzado", "Compras y proveedores", "Reportes avanzados", "Promociones y descuentos",
  "Historial de movimientos", "Alertas", "Exportación de información", "Importación de productos y ventas",
];

const planes = [
  { n: "Tappy Clientes frecuentes", p: "$599", d: "Para negocios que quieren fidelizar clientes, sin usar el punto de venta", pop: false, b: "Clientes frecuentes",
    f: ["Tarjeta digital con QR para cada cliente", "Recompensa por visitas: descuento en % o en monto, o producto de regalo", "Base de datos de tus clientes", "Catálogo de productos propio, sin necesidad de POS", "Funciona desde cualquier dispositivo", "Soporte estándar"],
    no: ["Punto de venta, cocina e inventario"] },
  { n: "Tappy Básico", p: "$699", d: "Negocios que comienzan o tienen una sola operación", pop: false, b: "Básico",
    f: ["1 sucursal", "4 usuarios incluidos", "2 cajas incluidas", ...base, "Dashboard", "Permisos por usuario", "Automatizaciones básicas (cocina en pantalla)", "Soporte estándar"],
    no: ["WhatsApp Business", "Pagos integrados", "API (próximamente)"] },
  { n: "Tappy Profesional", p: "$1,399", d: "Negocios que quieren conectar y automatizar", pop: true, b: "Profesional",
    f: ["1 sucursal", "10 usuarios incluidos", "3 cajas incluidas", ...base, "Dashboard avanzado", "Permisos por usuario", "Automatizaciones avanzadas", "WhatsApp Business", "Pagos integrados", "Soporte prioritario"],
    no: ["API (próximamente)"] },
  { n: "Tappy Empresarial", p: "$1,999", d: "Empresas que administran varias sucursales", pop: false, b: "Empresarial",
    f: ["Hasta 3 sucursales", "20 usuarios incluidos", "5 cajas incluidas", ...base, "Dashboard empresarial", "Permisos avanzados", "Automatizaciones avanzadas", "WhatsApp Business", "Pagos integrados", "Multi-sucursal", "Inventario por sucursal", "Reportes consolidados", "Auditoría avanzada", "API avanzada (próximamente)", "Soporte prioritario"],
    no: [] },
];

const faq = [
  ["¿Qué es Tappy?", "Tappy es una plataforma en la nube para operar tu negocio: ventas, mesas, cocina, inventario, reportes, clientes y equipo en un solo lugar."],
  ["¿Para qué tipo de negocios sirve?", "Restaurantes, cafeterías, taquerías, comida rápida, bares y restaurantes pequeños. Estamos preparando plantillas para otros giros."],
  ["¿Tappy funciona en la nube?", "Sí. Entras desde el navegador o la app, en celular, tablet o computadora, y tu información está siempre actualizada."],
  ["¿Los precios incluyen IVA?", "Sí. Los precios que ves en cada plan ya incluyen el IVA, no se suma nada al momento de pagar."],
  ["¿Qué incluye cada plan?", "Básico, Profesional y Empresarial incluyen punto de venta, inventario, reportes y promociones. Clientes frecuentes es solo el programa de recompensas, sin POS. Profesional agrega WhatsApp y pagos integrados; Empresarial agrega multi-sucursal y reportes consolidados."],
  ["¿Puedo personalizar mi plan?", "Sí. Puedes activar módulos extra y asientos de usuario adicionales según lo que necesite tu negocio. Escríbenos y lo armamos contigo."],
  ["¿Puedo cambiar de plan después?", "Claro, puedes subir o bajar de plan cuando tu operación lo requiera."],
  ["¿Puedo pasar mis productos y ventas actuales?", "Sí. Importamos productos y historial de ventas desde otras plataformas para que no empieces de cero."],
  ["¿Cómo es la implementación?", "Te ayudamos a configurar tu menú, tu equipo y tus cajas. La mayoría de los negocios empieza a vender en pocos días."],
  ["¿Ofrecen soporte técnico?", "Sí, por WhatsApp y correo. Los planes Profesional y Empresarial cuentan con soporte prioritario."],
  ["¿Qué información necesito para empezar?", "Tu lista de productos con precios, el número de usuarios y sucursales, y el método de cobro que usas. Si ya tienes un archivo de Excel, mejor."],
];

export default function Home() {
  return (
    <SiteShell>
      <main>
        <section className="tp-hero" id="inicio">
          <div className="tp-w">
            <div>
              <h1>El control de tu negocio, en un solo lugar.</h1>
              <p>Tappy une ventas, cocina, inventario, reportes y clientes en una plataforma que se ajusta a cómo trabajas tú.</p>
              <div className="tp-cta">
                <a className="tp-btn" href="#planes">Ver planes</a>
                <a className="tp-btn o" href={wa("Quiero agendar una demo")}>Hablar con asesor</a>
              </div>
              <a href="/login"><small>¿Ya eres cliente? Acceder a Tappy</small></a>
            </div>
            <div className="tp-mock" aria-hidden="true">
              <small>Dashboard · Hoy</small>
              <div className="tp-kp">
                <div><small>Ventas</small><b>$24,850</b></div>
                <div><small>Órdenes</small><b>186</b></div>
                <div><small>Ticket promedio</small><b>$133</b></div>
                <div><small>Productos</small><b>438</b></div>
              </div>
            </div>
          </div>
        </section>

        <section className="tp-sec alt" id="funciones">
          <div className="tp-w">
            <h2>Todo lo que necesitas para operar</h2>
            <p className="tp-sub">Funciones que ya usan restaurantes reales todos los días.</p>
            <div className="tp-grid">
              {funciones.map(([t, d]) => (<div className="tp-it" key={t}><h3>{t}</h3><p>{d}</p></div>))}
            </div>
          </div>
        </section>

        <section className="tp-sec" id="personalizable">
          <div className="tp-w">
            <div className="tp-cust">
              <h2>Tappy se arma a la medida de tu negocio</h2>
              <p className="tp-sub">No pagas por lo que no usas. Cada negocio configura su plataforma y nosotros la ajustamos contigo.</p>
              <div className="tp-grid">
                {medida.map(([t, d]) => (<div className="tp-it" key={t}><h3>{t}</h3><p>{d}</p></div>))}
              </div>
              <div className="tp-cta"><a className="tp-btn" href={wa("Quiero un Tappy a la medida de mi negocio")}>Cuéntanos qué necesitas</a></div>
            </div>
          </div>
        </section>

        <section className="tp-sec alt" id="tipos">
          <div className="tp-w">
            <h2>Se adapta a tu tipo de negocio</h2>
            <div className="tp-grid">
              {tipos.map(([t, d]) => (<div className="tp-it" key={t}><h3>{t}</h3><p>{d}</p></div>))}
            </div>
          </div>
        </section>

        <section className="tp-sec" id="planes">
          <div className="tp-w">
            <h2>Elige el plan que se adapte a tu negocio</h2>
            <p className="tp-sub">Empieza con lo que necesitas y escala cuando crezcas. Todos los precios están en pesos mexicanos al mes e incluyen IVA. ¿Necesitas algo distinto? Armamos un plan a tu medida.</p>
            <div className="tp-plans">
              {planes.map((pl) => (
                <div key={pl.n} className={"tp-pl" + (pl.pop ? " pop" : "")}>
                  {pl.pop && <span className="tp-tag">Más popular</span>}
                  <h3>{pl.n}</h3>
                  <div className="tp-pr">{pl.p}<span> MXN/mes</span><div style={{ fontSize: ".85rem", fontWeight: 500, color: "#5b6486", fontFamily: "Inter,sans-serif" }}>IVA incluido</div></div>
                  <p>{pl.d}</p>
                  <ul>
                    {pl.f.map((x) => <li key={x}>{x}</li>)}
                    {pl.no.map((x) => <li className="no" key={x}>{x}</li>)}
                  </ul>
                  <a className={"tp-btn" + (pl.pop ? "" : " o")} href={wa(`Quiero contratar el plan ${pl.b}`)}>Elegir {pl.b}</a>
                </div>
              ))}
            </div>
            <p className="tp-sub">¿No sabes qué plan necesitas? <a href={wa("Quiero agendar una demo")} style={{ color: "var(--ember)", fontWeight: 600 }}>Habla con un asesor</a>.</p>
          </div>
        </section>

        <section className="tp-sec alt" id="faq">
          <div className="tp-w">
            <h2>Preguntas frecuentes</h2>
            <div className="tp-faq">
              {faq.map(([q, a]) => (<details key={q}><summary>{q}</summary><p>{a}</p></details>))}
            </div>
          </div>
        </section>

        <section className="tp-end">
          <div className="tp-w">
            <h2>Deja que Tappy lleve la operación y tú atiende a tus clientes</h2>
            <p>Agenda una demo y te mostramos Tappy con el menú de tu negocio.</p>
            <div className="tp-cta">
              <a className="tp-btn" href={wa("Quiero agendar una demo")}>Agendar demo</a>
              <a className="tp-btn o" href="#planes">Ver planes</a>
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
