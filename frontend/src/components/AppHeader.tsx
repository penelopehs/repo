// Sticky enterprise header — Deep Navy bar with active route states and mobile sheet nav.

import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Calculator, Users, LogIn, LogOut, FileText, Menu } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";

const NAV = [
  { to: "/", label: "Calculator", icon: Calculator },
  { to: "/pipeline", label: "Client Dashboard", icon: Users },
  { to: "/documents", label: "Document Requests", icon: FileText },
] as const;

export function AppHeader() {
  const { location } = useRouterState();
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-navy/20 bg-navy text-navy-foreground shadow-elevated">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 backdrop-blur ring-1 ring-white/20 transition-transform group-hover:scale-105">
            <span className="text-sm font-bold tracking-tight" style={{ color: "var(--logo)" }}>
              SB
            </span>
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-sm font-bold text-white">Sales Billing Calculator</p>
            <p className="text-[11px] text-white/70">R&amp;D Tax Credit &amp; Billing</p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) => {
            const active = isActive(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
                  active ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{n.label}</span>
                {active && (
                  <span className="absolute -bottom-1 left-3 right-3 h-0.5 rounded-full bg-orange" />
                )}
              </Link>
            );
          })}
          {isAuthenticated ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => { logout(); navigate({ to: "/login" }); }}
              className="ml-2 text-white/85 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              {user?.displayName ?? "Sign out"}
            </Button>
          ) : (
            <Link
              to="/login"
              className="ml-2 inline-flex items-center gap-2 rounded-md bg-orange px-3 py-2 text-sm font-semibold text-orange-foreground shadow-elevated hover:bg-orange/90"
            >
              <LogIn className="h-4 w-4" /> Log In
            </Link>
          )}
        </nav>

        {/* Mobile nav */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden text-white hover:bg-white/10">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-navy text-navy-foreground border-navy/30">
            <nav className="mt-8 flex flex-col gap-1">
              {NAV.map((n) => {
                const Icon = n.icon;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive(n.to) ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" /> {n.label}
                  </Link>
                );
              })}
              <div className="mt-4 border-t border-white/10 pt-4">
                {isAuthenticated ? (
                  <button
                    onClick={() => { logout(); setMobileOpen(false); navigate({ to: "/login" }); }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-md bg-orange px-3 py-2.5 text-sm font-semibold text-orange-foreground"
                  >
                    <LogIn className="h-4 w-4" /> Log In
                  </Link>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
