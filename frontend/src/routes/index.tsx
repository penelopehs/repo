import { createFileRoute } from "@tanstack/react-router";
import { PipelinePage } from "@/pages/PipelinePage";

// The client dashboard is the app's home page.
export const Route = createFileRoute("/")({
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
