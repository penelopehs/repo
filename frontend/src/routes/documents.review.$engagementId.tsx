import { createFileRoute } from "@tanstack/react-router";
import { ReviewRequestPage } from "@/pages/ReviewRequestPage";

export const Route = createFileRoute("/documents/review/$engagementId")({
  head: () => ({
    meta: [
      { title: "Review Request — Documents" },
      { name: "description", content: "Review the email preview before sending the document request." },
    ],
  }),
  component: ReviewRequestPage,
});
