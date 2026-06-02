import { createFileRoute } from "@tanstack/react-router";
import { PipelinePage } from "@/pages/PipelinePage";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Client Dashboard — Sales Billing CRM" },
      { name: "description", content: "Manage leads, send proposals, and track active client engagements." },
      { property: "og:title", content: "Client Dashboard" },
      { property: "og:description", content: "Manage leads, send proposals, and track active engagements." },
    ],
  }),
  component: PipelinePage,
});
