import { prisma } from "@/lib/prisma";
import { PlansClient } from "./plans-client";

export default async function PlansPage() {
  const plans = await prisma.plan.findMany({
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { priceMxn: "asc" },
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-1">Planes</h1>
      <p className="text-muted text-sm mb-8">Los planes que se ofrecen a los restaurantes de la plataforma.</p>
      <PlansClient initialPlans={JSON.parse(JSON.stringify(plans))} />
    </div>
  );
}
