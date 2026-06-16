import { createFileRoute } from "@tanstack/react-router";
import { CalculatorPage } from "@/pages/CalculatorPage";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search.leadId;
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    return { leadId: Number.isFinite(n) ? n : undefined };
  },
  head: () => ({
    meta: [
      { title: "R&D Billing Calculator — AcquireIQ" },
      {
        name: "description",
        content: "Enterprise R&D tax credit and billing calculator for multi-entity clients.",
      },
      { property: "og:title", content: "R&D Billing Calculator" },
      { property: "og:description", content: "Enterprise R&D tax credit and billing calculator." },
    ],
  }),
  component: CalculatorPage,
});
