import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("[auth] Falta correo o contraseña en la petición");
          return null;
        }

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: { role: { include: { permissions: { include: { permission: true } } } } },
          });
        } catch (err) {
          console.log("[auth] Error consultando la base de datos:", err);
          return null;
        }

        if (!user) {
          console.log(`[auth] No existe usuario con correo: ${credentials.email}`);
          return null;
        }
        if (!user.isActive) {
          console.log(`[auth] Usuario ${credentials.email} está inactivo`);
          return null;
        }

        const validPassword = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!validPassword) {
          console.log(`[auth] Contraseña incorrecta para: ${credentials.email}`);
          return null;
        }

        console.log(`[auth] Login exitoso: ${credentials.email}`);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          companyId: user.companyId,
          branchId: user.branchId,
          roleName: user.role.name,
          permissions: user.role.permissions.map((rp: (typeof user.role.permissions)[number]) => rp.permission.key),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.companyId = user.companyId;
        token.branchId = user.branchId;
        token.roleName = user.roleName;
        token.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.companyId = token.companyId as string | null;
      session.user.branchId = token.branchId as string | null;
      session.user.roleName = token.roleName as string;
      session.user.permissions = token.permissions as string[];
      return session;
    },
  },
};