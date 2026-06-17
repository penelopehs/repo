import { createFileRoute, redirect } from "@tanstack/react-router";

// The root path no longer hosts the calculator (now at /calculator). Send it to
// the client dashboard, the app's primary landing surface.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/pipeline" });
  },
});
