// MSAL (Microsoft Entra ID) configuration — ported from the test_front example.
// All three values come from the Entra ID app registration. See .env.example.
//
// NOTE: This is an SSR app (TanStack Start). Constructing PublicClientApplication
// at module scope is safe — MSAL guards all browser APIs behind an
// isBrowserEnvironment() check and only touches window/crypto/storage once
// initialize()/loginPopup()/etc. are called (which only happens client-side).

import {
  PublicClientApplication,
  type Configuration,
  type RedirectRequest,
  type SilentRequest,
} from "@azure/msal-browser";

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID;
export const apiScope = import.meta.env.VITE_API_SCOPE;

// The redirect URI is the app root (window.location.origin), which must be
// registered as a "Single-page application (SPA)" redirect in the Entra app
// registration (e.g. http://localhost:5173). The popup/silent flows land this
// URI inside a popup/iframe with the OAuth response in the URL fragment; our
// custom client entry (src/client.tsx) relays that response to the opener via
// MSAL's redirect bridge before the router hydrates, so the root URI works
// without a dedicated callback page. Falls back to "/" during SSR.
const redirectUri = typeof window !== "undefined" ? window.location.origin : "/";

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
  },
  cache: {
    // sessionStorage keeps tokens out of localStorage; cleared when tab closes.
    cacheLocation: "sessionStorage",
  },
};

// Scopes requested at login. "openid"/"profile" give us id-token claims;
// the API scope lets us call the FastAPI backend.
export const loginRequest: RedirectRequest = {
  scopes: ["openid", "profile", ...(apiScope ? [apiScope] : [])],
};

// Scope used when silently acquiring an access token for API calls.
export const apiRequest: SilentRequest = {
  scopes: apiScope ? [apiScope] : [],
};

export const msalInstance = new PublicClientApplication(msalConfig);
