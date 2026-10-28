-- Asientos extra (o menos) de usuarios por sucursal, por suscripción.
ALTER TABLE "subscriptions" ADD COLUMN "extraUsersPerBranch" INTEGER NOT NULL DEFAULT 0;
