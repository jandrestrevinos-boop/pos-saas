// Script temporal para resetear tu contraseña correctamente (con bcrypt).
// Bórralo después de usarlo.
//
// Uso: npx tsx prisma/reset-password.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 👇 Cambia estos dos valores antes de correr el script
const EMAIL = "contacto@tappysoftware.com";
const NUEVA_CONTRASENA = "304.jatS";

async function main() {
  const passwordHash = await bcrypt.hash(NUEVA_CONTRASENA, 10);

  const user = await prisma.user.update({
    where: { email: EMAIL },
    data: { passwordHash },
  });

  console.log("✅ Contraseña actualizada correctamente para:", user.email);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e.message);
  })
  .finally(() => prisma.$disconnect());
