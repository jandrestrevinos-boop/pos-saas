# POS SaaS Multiempresa — Fase 1

Base del proyecto: configuración, esquema de base de datos completo, autenticación y estructura multi-tenant con roles y permisos.

## Qué incluye esta fase

- `prisma/schema.prisma` — esquema completo de base de datos (empresas, sucursales, usuarios, roles, permisos, productos, ventas, caja, inventario, auditoría).
- `prisma/seed.ts` — datos de demo: empresa "Taquería Demo", 5 roles con permisos, usuarios de prueba, categorías y productos.
- `src/lib/auth.ts` — autenticación con NextAuth (login por correo/contraseña).
- `src/lib/tenant-context.ts` — punto único para obtener "quién pregunta" (empresa/sucursal/rol) en cualquier parte del backend, evitando fugas de datos entre empresas.
- `src/lib/permissions.ts` — catálogo de permisos y matriz por defecto de cada rol.

## Cómo correrlo localmente

1. **Instalar dependencias**
   ```bash
   npm install
   ```

2. **Base de datos**: necesitas PostgreSQL corriendo localmente. La forma más simple si no tienes Postgres instalado es con Docker:
   ```bash
   docker run --name pos-saas-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=pos_saas -p 5432:5432 -d postgres:16
   ```

3. **Variables de entorno**
   ```bash
   cp .env.example .env
   ```
   Ajusta `DATABASE_URL` si tu configuración de Postgres es distinta. Genera un valor para `NEXTAUTH_SECRET` con:
   ```bash
   openssl rand -base64 32
   ```

4. **Crear las tablas**
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Cargar datos demo**
   ```bash
   npm run prisma:seed
   ```

6. **Correr el proyecto**
   ```bash
   npm run dev
   ```
   Abre http://localhost:3000

## Usuarios de prueba (contraseña entre paréntesis)

| Rol | Correo | Contraseña |
|---|---|---|
| Super Admin (plataforma) | superadmin@plataforma.com | SuperAdmin123! |
| Admin Empresa | admin@taqueriademo.com | Demo123! |
| Gerente | gerente@taqueriademo.com | Demo123! |
| Cajero | cajero@taqueriademo.com | Demo123! |
| Mesero | mesero@taqueriademo.com | Demo123! |

## Cómo verificar que la Fase 1 funciona

- `npx prisma studio` te abre una interfaz visual para ver las tablas creadas y confirmar que la empresa demo, sucursal, productos y usuarios se cargaron correctamente.
- Todavía no hay pantallas de login/POS en esta fase — eso es la Fase 2 y 3. Esta fase es la base de datos + autenticación + estructura, que es lo que el resto de la plataforma va a usar.

## Siguiente paso (Fase 2, pendiente de tu aprobación)

Pantallas y APIs de: Empresas, Sucursales, Usuarios, Productos y Categorías (paneles Super Admin y Admin de Empresa).
