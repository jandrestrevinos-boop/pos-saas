import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.roleName;

    // Excluir webhook de autenticación
    if (pathname.startsWith("/inicio/webhook")) {
      return NextResponse.next();
    }

    // Solo SUPER_ADMIN puede entrar a /plataforma/*
    if (pathname.startsWith("/plataforma") && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // SUPER_ADMIN no opera el panel ni el POS de un restaurante individual
    if (
      role === "SUPER_ADMIN" &&
      ["/dashboard", "/products", "/categories", "/branches", "/users", "/pos", "/cash", "/reports", "/inventory", "/kitchen", "/clientes-frecuentes"].some((p) => pathname.startsWith(p))
    ) {
      return NextResponse.redirect(new URL("/plataforma/dashboard", req.url));
    }

    // Pasa la ruta actual a los server components (el layout de empresa la usa para
    // aplicar el modo "solo clientes frecuentes").
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/products/:path*", "/categories/:path*", "/branches/:path*", "/users/:path*", "/pos/:path*", "/cash/:path*", "/reports/:path*", "/inventory/:path*", "/kitchen/:path*", "/clientes-frecuentes/:path*", "/plataforma/:path*", "/facturacion/:path*"],
};
