import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/pages/LoginPage";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Sales Billing Calculator" },
      { name: "description", content: "Sign in to the enterprise R&D tax credit and billing workspace." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LoginPage,
});
