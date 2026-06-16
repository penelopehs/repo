import { createFileRoute } from "@tanstack/react-router";
import { ConfigureRequestPage } from "@/pages/ConfigureRequestPage";

export const Route = createFileRoute("/documents/configure")({
  head: () => ({
    meta: [
      { title: "Configure Request — Documents" },
      { name: "description", content: "Create a new document request for an active engagement." },
    ],
  }),
  component: ConfigureRequestPage,
});
