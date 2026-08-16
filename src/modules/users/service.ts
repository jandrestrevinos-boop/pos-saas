import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

export const createUserSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  roleId: z.string().min(1, "Selecciona un rol"),
  branchId: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const usersService = {
  async list(companyId: string) {
    return prisma.user.findMany({
      where: { companyId },
      include: { role: true, branch: true },
      orderBy: { createdAt: "asc" },
    });
  },

  async create(companyId: string, input: CreateUserInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new Error("Ya existe un usuario con ese correo");
    }

    // Respeta el límite de usuarios del plan contratado por la empresa.
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
      include: { license: true },
    });
    if (subscription?.license) {
      const currentUserCount = await prisma.user.count({ where: { companyId } });
      if (currentUserCount >= subscription.license.allowedUsers) {
        throw new Error(
          `Esta empresa ya alcanzó el límite de ${subscription.license.allowedUsers} usuarios de su plan. Sube de plan para agregar más.`
        );
      }
    }

    // Si no se especifica sucursal, se asigna la primera de la empresa.
    let branchId = input.branchId;
    if (!branchId) {
      const firstBranch = await prisma.branch.findFirst({ where: { companyId } });
      branchId = firstBranch?.id;
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    return prisma.user.create({
      data: {
        companyId,
        branchId,
        name: input.name,
        email: input.email,
        passwordHash,
        roleId: input.roleId,
      },
      include: { role: true, branch: true },
    });
  },

  async setActive(companyId: string, id: string, isActive: boolean) {
    const result = await prisma.user.updateMany({ where: { id, companyId }, data: { isActive } });
    if (result.count === 0) throw new Error("Usuario no encontrado");
  },
};
