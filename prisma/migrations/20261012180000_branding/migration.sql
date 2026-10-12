-- CreateTable
CREATE TABLE "company_branding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "brandName" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "accentColor" TEXT,
    "sidebarColor" TEXT,
    "fontBody" TEXT,
    "fontDisplay" TEXT,
    "fontScale" TEXT,
    "showProductImages" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_branding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_branding_companyId_key" ON "company_branding"("companyId");
