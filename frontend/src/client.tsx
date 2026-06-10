// Custom TanStack Start client entry (auto-detected, overrides the framework
// default). Initializes MSAL and processes any redirect response before
// hydrating so MsalProvider always receives a ready, up-to-date instance.

import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";
import { EventType, type AuthenticationResult, type EventMessage } from "@azure/msal-browser";
import { msalInstance } from "@/lib/auth/authConfig";

async function bootstrap() {
  await msalInstance.initialize();

  // Process the redirect response if the user just came back from Azure AD.
  // Returns the AuthenticationResult with tokens, or null if no redirect in flight.
  const redirectResult = await msalInstance.handleRedirectPromise();
  if (redirectResult?.account) {
    msalInstance.setActiveAccount(redirectResult.account);
    // Fresh login — send to pipeline instead of landing on the root/calculator.
    if (window.location.pathname === "/") {
      window.location.replace("/pipeline");
      return;
    }
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

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  });
}

void bootstrap();
