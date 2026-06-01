import { useState } from "react";
import { useMsal } from "@azure/msal-react";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loginRequest } from "@/lib/auth/authConfig";

export function LoginPage() {
  const { instance } = useMsal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setError(null);
    setLoading(true);
    try {
      // Navigates to Azure AD; the page won't continue past this call.
      // On return, client.tsx processes handleRedirectPromise() before hydrating.
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
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

        <div className="space-y-4 px-8 py-7">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <Button
            type="button"
            onClick={signIn}
            disabled={loading}
            className="w-full bg-orange text-orange-foreground hover:bg-orange/90 shadow-elevated"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MicrosoftLogo className="mr-2 h-4 w-4" />
            )}
            {loading ? "Signing in..." : "Sign in with Microsoft"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Authentication is handled by Microsoft Entra ID (Azure AD).
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// Microsoft four-square logo mark.
function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
