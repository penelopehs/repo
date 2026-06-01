import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Pin the dev server to 5173 so MSAL's redirect URI (window.location.origin)
  // matches the "http://localhost:5173" SPA redirect registered in the Entra
  // app registration. strictPort fails loudly instead of drifting to 5174.
  vite: {
    server: { port: 5173, strictPort: true },
  },
});
