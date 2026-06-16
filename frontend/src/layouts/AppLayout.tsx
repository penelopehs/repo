import { Outlet } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";
import { Toaster } from "@/components/ui/sonner";

export function AppLayout() {
  return (
    <>
      <div className="min-h-screen bg-background">
        <AppHeader />
        <Outlet />
      </div>
      <Toaster richColors position="top-right" />
    </>
  );
}
