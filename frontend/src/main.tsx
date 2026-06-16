import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { EventType, type AuthenticationResult, type EventMessage } from "@azure/msal-browser";

import { getRouter } from "./router";
import { msalInstance } from "@/lib/auth/authConfig";
import "./styles.css";

const router = getRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Initialize MSAL and process any redirect response before rendering so
// MsalProvider always receives a ready, up-to-date instance. (This logic
// previously lived in the TanStack Start client entry, src/client.tsx.)
async function bootstrap() {
  await msalInstance.initialize();

  // Process the redirect response if the user just came back from Azure AD.
  // Returns the AuthenticationResult with tokens, or null if none in flight.
  const redirectResult = await msalInstance.handleRedirectPromise();
  if (redirectResult?.account) {
    msalInstance.setActiveAccount(redirectResult.account);
  } else {
    // No redirect — restore cached account if one exists.
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
      msalInstance.setActiveAccount(accounts[0]);
    }
  }

  msalInstance.addEventCallback((event: EventMessage) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as AuthenticationResult;
      if (payload.account) {
        msalInstance.setActiveAccount(payload.account);
      }
    }
  });

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

void bootstrap();
