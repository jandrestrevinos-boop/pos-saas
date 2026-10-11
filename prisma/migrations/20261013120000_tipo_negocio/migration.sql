-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('RESTAURANTE', 'CAFETERIA', 'ESCUELA', 'DISTRIBUIDOR', 'LABORATORIO');

-- AlterTable: aditivo. Las empresas que ya existen quedan como RESTAURANTE.
ALTER TABLE "companies" ADD COLUMN     "businessType" "BusinessType" NOT NULL DEFAULT 'RESTAURANTE';
