import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/pages/ProfilePage";

export const Route = createFileRoute("/clients/$id")({
  head: () => ({
    meta: [
      { title: "Client Profile — Sales Billing CRM" },
      {
        name: "description",
        content: "Client overview with engagements, contacts, intake, and follow-up calls.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ClientProfileRoute,
});

function ClientProfileRoute() {
  const { id } = Route.useParams();
  return <ProfilePage id={id} />;
}
