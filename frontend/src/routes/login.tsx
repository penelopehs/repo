import { createFileRoute, redirect } from "@tanstack/react-router";

// Login now lives at the root ("/"), gated by AuthGate in __root.tsx.
// Keep this route as a redirect so any old /login links still work.
export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
