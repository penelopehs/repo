import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { ProfilePage } from "@/pages/ProfilePage";

export const Route = createFileRoute("/clients/$id")({
  head: () => ({
    meta: [
      { title: "Client Profile — Acquire Sales" },
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (pathname === `/clients/${id}`) {
    return <ProfilePage id={id} />;
  }

  return <Outlet />;
}
