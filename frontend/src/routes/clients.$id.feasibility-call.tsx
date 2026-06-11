import { createFileRoute } from "@tanstack/react-router";
import { FeasibilityCallPage } from "@/pages/FeasibilityCallPage";

export const Route = createFileRoute("/clients/$id/feasibility-call")({
  validateSearch: (search: Record<string, unknown>) => ({
    callId: typeof search.callId === "string" ? search.callId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Feasibility Call — AcquireIQ" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: FeasibilityCallRoute,
});

function FeasibilityCallRoute() {
  const { id } = Route.useParams();
  const { callId } = Route.useSearch();
  return <FeasibilityCallPage leadId={id} callId={callId} />;
}