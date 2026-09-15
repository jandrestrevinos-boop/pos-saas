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
          console.log("[AUTH DEBUG] Falta email o password en el request");
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        });

        console.log("[AUTH DEBUG] Buscando usuario:", credentials.email, "-> encontrado:", !!user, "isActive:", user?.isActive);

        if (!user || !user.isActive) return null;

        const validPassword = await bcrypt.compare(credentials.password, user.passwordHash);
        console.log("[AUTH DEBUG] Password hash en BD (primeros 10 chars):", user.passwordHash?.slice(0, 10), "-> coincide:", validPassword);

        if (!validPassword) return null;

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
