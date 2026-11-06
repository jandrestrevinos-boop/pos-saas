import type { ReactNode } from "react";

export const WA = "https://api.whatsapp.com/send/?phone=5218123557288&text=";
export const wa = (t: string) => WA + encodeURIComponent(t);
export const EMAIL = "contacto@tappysoftware.com";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap');
.tp{--ink:#0A0F2E;--ember:#0038FF;--teal:#00B4D8;--sage:#3F7D20;--paper:#F7F9FC;--line:#DDE3EE;font-family:Inter,system-ui,sans-serif;color:var(--ink);background:var(--paper);line-height:1.6;min-height:100vh}
.tp *{box-sizing:border-box}.tp a{color:inherit;text-decoration:none}
.tp h1,.tp h2,.tp h3{font-family:Fraunces,Georgia,serif;line-height:1.15;margin:0;letter-spacing:-.01em}
.tp-w{max-width:1120px;margin:0 auto;padding:0 20px}
.tp-hd{position:sticky;top:0;z-index:20;background:rgba(247,249,252,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.tp-hd .tp-w{display:flex;align-items:center;justify-content:space-between;height:112px}
.tp-logo{height:88px;width:auto;display:block}
.tp-nav{display:none;gap:28px;font-weight:500}.tp-nav a:hover{color:var(--ember)}
.tp-btn{display:inline-block;padding:12px 22px;border-radius:10px;font-weight:600;background:var(--ember);color:#fff!important;border:2px solid var(--ember)}
.tp-btn:hover{background:#0029c4}.tp-btn.o{background:transparent;color:var(--ember)!important}.tp-btn.o:hover{background:#e8eeff}
.tp a:focus-visible,.tp summary:focus-visible{outline:3px solid var(--teal);outline-offset:3px}
.tp-hero{padding:56px 0 64px}.tp-hero .tp-w{display:grid;gap:40px}
.tp-hero h1{font-size:clamp(2.1rem,6vw,3.6rem);max-width:15ch}
.tp-hero p{font-size:1.15rem;max-width:52ch;color:#38405e}
.tp-cta{display:flex;flex-wrap:wrap;gap:12px;margin:28px 0 14px}
.tp-mock{background:var(--ink);color:#fff;border-radius:18px;padding:22px;box-shadow:0 20px 50px rgba(10,15,46,.25)}
.tp-mock small{color:#9fb0ff}.tp-kp{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:14px}
.tp-kp div{background:rgba(255,255,255,.07);border-radius:12px;padding:14px}.tp-kp b{display:block;font-size:1.5rem;font-family:Fraunces,serif}
.tp-sec{padding:64px 0}.tp-sec.alt{background:#fff;border-block:1px solid var(--line)}
.tp-sec h2{font-size:clamp(1.7rem,4vw,2.4rem);max-width:22ch}.tp-sub{max-width:60ch;color:#4a5272;margin:12px 0 0}
.tp-grid{display:grid;gap:18px;margin-top:32px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.tp-it{border-top:3px solid var(--ember);padding:14px 0 6px}.tp-it h3{font-size:1.2rem;margin-bottom:6px}.tp-it p{margin:0;color:#4a5272}
.tp-cust{background:var(--ink);color:#fff;border-radius:22px;padding:36px 24px;margin-top:8px}
.tp-cust .tp-sub{color:#b9c3ee}.tp-cust .tp-it{border-color:var(--teal)}.tp-cust .tp-it p{color:#c9d2f5}
.tp-plans{display:grid;gap:20px;margin-top:36px;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));align-items:start}
.tp-pl{background:#fff;border:1px solid var(--line);border-radius:18px;padding:28px}.tp-pl.pop{border:2px solid var(--ember);box-shadow:0 14px 40px rgba(0,56,255,.14)}
.tp-pl h3{font-size:1.5rem}.tp-pr{font-family:Fraunces,serif;font-size:2.6rem;font-weight:700;margin:10px 0 0}.tp-pr span{font-size:1rem;font-family:Inter;font-weight:500;color:#5b6486}
.tp-pl ul{list-style:none;padding:0;margin:20px 0 24px;display:grid;gap:8px;font-size:.95rem}
.tp-pl li:before{content:"✓";color:var(--sage);font-weight:700;margin-right:8px}.tp-pl li.no{color:#8a91ac}.tp-pl li.no:before{content:"—";color:#8a91ac}
.tp-pl .tp-btn{width:100%;text-align:center}.tp-tag{display:inline-block;background:var(--ember);color:#fff;border-radius:99px;padding:3px 12px;font-size:.8rem;font-weight:600;margin-bottom:10px}
.tp-faq{max-width:760px;margin-top:28px}.tp-faq details{border-bottom:1px solid var(--line);padding:16px 0}
.tp-faq summary{cursor:pointer;font-weight:600;font-size:1.05rem}.tp-faq p{margin:10px 0 0;color:#4a5272}
.tp-end{background:var(--ink);color:#fff;text-align:center;padding:72px 0}.tp-end h2{margin:0 auto 14px;max-width:24ch}.tp-end .tp-cta{justify-content:center}.tp-end .tp-btn.o{color:#fff!important;border-color:#fff}.tp-end .tp-btn.o:hover{background:rgba(255,255,255,.12)}
.tp-ft{background:#060921;color:#c3cbee;padding:52px 0 28px}.tp-ft .tp-w{display:grid;gap:32px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.tp-ft img{height:104px;width:auto;margin-bottom:12px}.tp-ft h4{color:#fff;margin:0 0 10px;font-size:1rem}.tp-ft ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}.tp-ft a:hover{color:#fff;text-decoration:underline}
.tp-cp{grid-column:1/-1;border-top:1px solid #1c2250;padding-top:20px;font-size:.88rem}
.tp-doc{max-width:760px;padding:56px 20px 72px;margin:0 auto}.tp-doc h1{font-size:clamp(2rem,5vw,2.8rem);margin-bottom:8px}.tp-doc h2{font-size:1.35rem;margin:32px 0 8px}.tp-doc p,.tp-doc li{color:#38405e}.tp-doc small{color:#6b7391}
@media(min-width:860px){.tp-nav{display:flex}.tp-hero .tp-w{grid-template-columns:1.1fr .9fr;align-items:center}.tp-logo{height:100px}.tp-cust{padding:48px}}
@media(prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
`;

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="tp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="tp-hd">
        <div className="tp-w">
          <a href="/"><img className="tp-logo" src="/images/logo.png" alt="Tappy" /></a>
          <nav className="tp-nav" aria-label="Principal">
            <a href="/#funciones">Funciones</a>
            <a href="/#personalizable">A tu medida</a>
            <a href="/#planes">Planes</a>
            <a href="/#faq">Preguntas</a>
          </nav>
          <a className="tp-btn" href="/login">Acceder a Tappy</a>
        </div>
      </header>
      {children}
      <footer className="tp-ft">
        <div className="tp-w">
          <div>
            <img src="/images/logo.png" alt="Tappy" />
            <p>El sistema para operar tu negocio desde un solo lugar.</p>
          </div>
          <div><h4>Producto</h4><ul>
            <li><a href="/#funciones">Funciones</a></li>
            <li><a href="/#personalizable">A tu medida</a></li>
            <li><a href="/#planes">Planes</a></li>
          </ul></div>
          <div><h4>Compañía</h4><ul>
            <li><a href="/nosotros">Sobre nosotros</a></li>
            <li><a href="/contacto">Contacto</a></li>
            <li><a href={wa("Quiero agendar una demo")}>Agendar demo</a></li>
          </ul></div>
          <div><h4>Legal</h4><ul>
            <li><a href="/privacidad">Aviso de privacidad</a></li>
            <li><a href="/terminos">Términos y condiciones</a></li>
          </ul></div>
          <p className="tp-cp">© {new Date().getFullYear()} Tappy. Todos los derechos reservados. · {EMAIL}</p>
        </div>
      </footer>
    </div>
  );
}

export function Doc({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <SiteShell>
      <main className="tp-doc">
        <h1>{title}</h1>
        {updated && <small>Última actualización: {updated}</small>}
        {children}
      </main>
    </SiteShell>
  );
}
