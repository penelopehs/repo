import { createFileRoute } from "@tanstack/react-router";
import { PipelinePage } from "@/pages/PipelinePage";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Client Pipeline — AcquireIQ" },
      {
        name: "description",
        content: "Manage leads, send proposals, and track active client engagements.",
      },
      { property: "og:title", content: "Client Pipeline" },
      {
        property: "og:description",
        content: "Manage leads, send proposals, and track active engagements.",
      },
    ],
  }),
  component: PipelinePage,
});
