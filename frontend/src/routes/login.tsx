import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginPage } from "@/pages/LoginPage";
import { isAuthenticated } from "@/lib/auth/authConfig";

export const Route = createFileRoute("/login")({
  // Already signed in with Microsoft? Skip the login page.
  beforeLoad: () => {
    if (isAuthenticated()) throw redirect({ to: "/", search: { leadId: undefined } });
  },
  head: () => ({
    meta: [
      { title: "Sign In — AcquireIQ" },
      {
        name: "description",
        content: "Sign in to the enterprise R&D tax credit and billing workspace.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LoginPage,
});
