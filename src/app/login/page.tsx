import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo: identidad de marca */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] bg-ink-950 text-white p-12">
        <p className="font-display text-2xl font-semibold">Plataforma POS</p>
        <div>
          <p className="font-display text-4xl leading-tight mb-4">
            El punto de venta para restaurantes que crecen.
          </p>
          <p className="text-white/60 text-sm">
            Ventas, caja, inventario y reportes — una cuenta por cada restaurante, todo en un mismo lugar.
          </p>
        </div>
        <p className="text-white/40 text-xs font-mono">v1.0 — Fase 2</p>
      </div>

      {/* Panel derecho: formulario */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1">Bienvenido de vuelta</h1>
          <p className="text-muted text-sm mb-8">Entra con tu correo y contraseña.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
