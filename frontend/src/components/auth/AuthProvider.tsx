import { type ReactNode } from "react";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "@/lib/auth/authConfig";

// MsalProvider receives an already-initialized instance (initialization and
// event wiring happen in src/client.tsx before hydrateRoot is called).
export function AuthProvider({ children }: { children: ReactNode }) {
  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
