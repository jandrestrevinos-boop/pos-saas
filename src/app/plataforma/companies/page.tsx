import { companiesService } from "@/modules/companies/service";
import { CompaniesTable } from "./companies-table";
import { prisma } from "@/lib/prisma";

export default async function CompaniesPage() {
  const [companies, plans, roles] = await Promise.all([
    companiesService.list(),
    prisma.plan.findMany({ orderBy: { priceMxn: "asc" } }),
    prisma.role.findMany({ where: { name: { not: "SUPER_ADMIN" } }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-1">Empresas</h1>
          <p className="text-muted text-sm">Restaurantes dados de alta en la plataforma.</p>
        </div>
      </div>

      <CompaniesTable
        initialCompanies={JSON.parse(JSON.stringify(companies))}
        plans={JSON.parse(JSON.stringify(plans))}
        roles={JSON.parse(JSON.stringify(roles))}
      />
    </div>
  );
}
