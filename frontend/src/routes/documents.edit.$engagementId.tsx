import { createFileRoute } from "@tanstack/react-router";
import { EditRequestPage } from "@/pages/EditRequestPage";

export const Route = createFileRoute("/documents/edit/$engagementId")({
  head: () => ({
    meta: [
      { title: "Edit Request — Documents" },
      {
        name: "description",
        content: "Edit a document request: documents, recipients, due date and notes.",
      },
    ],
  }),
  component: EditRequestPage,
});
