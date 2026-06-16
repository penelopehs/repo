/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Microsoft Entra ID (Azure AD) — public SPA values, safe to ship in the bundle.
  readonly VITE_AZURE_CLIENT_ID: string;
  readonly VITE_AZURE_TENANT_ID: string;
  readonly VITE_API_SCOPE: string;
  // FastAPI backend base URL used by the API service.
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
