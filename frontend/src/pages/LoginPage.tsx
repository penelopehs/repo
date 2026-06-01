// Frontend Login page — mock authentication, validated, token-ready.

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { motion } from "framer-motion";
import { LogIn, Loader2, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

const schema = z.object({
  username: z.string().trim().min(2, "Username too short").max(60),
  password: z.string().min(4, "Minimum 4 characters").max(120),
});

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ username, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      await login(parsed.data.username, parsed.data.password);
      toast.success("Welcome back", { description: parsed.data.username });
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-frost px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-hover"
      >
        <div className="bg-gradient-navy px-8 py-8 text-navy-foreground">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
              <ShieldCheck className="h-5 w-5" style={{ color: "var(--logo)" }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Secure access</p>
              <h1 className="text-xl font-bold text-white">Sales Billing Calculator</h1>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/75">Sign in to your enterprise R&amp;D billing workspace.</p>
        </div>

        <form onSubmit={submit} className="space-y-4 px-8 py-7">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Michael Williams"
              maxLength={60}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              maxLength={120}
            />
          </div>
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-orange text-orange-foreground hover:bg-orange/90 shadow-elevated"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            {loading ? "Signing in..." : "Sign In"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Frontend mock authentication. Azure AD / MSAL integration ready for production.
          </p>
        </form>
      </motion.div>
    </div>
  );
}
