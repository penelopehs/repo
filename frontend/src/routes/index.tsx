import { createFileRoute } from "@tanstack/react-router";
import { CalculatorPage } from "@/pages/CalculatorPage";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    clientName: typeof search.clientName === "string" ? search.clientName : undefined,
  }),
  head: () => ({
    meta: [
      { title: "R&D Billing Calculator — Sales Billing Platform" },
      { name: "description", content: "Enterprise R&D tax credit and billing calculator for multi-entity clients." },
      { property: "og:title", content: "R&D Billing Calculator" },
      { property: "og:description", content: "Enterprise R&D tax credit and billing calculator." },
    ],
  }),
  component: CalculatorPage,
});
