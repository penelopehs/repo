import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { DocumentsPage } from "@/pages/DocumentsPage";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Document Requests — AcquireIQ" },
      {
        name: "description",
        content: "Track every document request sent to engaged clients across all engagements.",
      },
      { property: "og:title", content: "Document Request Overview" },
      {
        property: "og:description",
        content: "Track every document request sent to engaged clients.",
      },
    ],
  }),
  component: DocumentsRouteComponent,
});

function DocumentsRouteComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (pathname === "/documents") {
    return <DocumentsPage />;
  }

  return <Outlet />;
}
