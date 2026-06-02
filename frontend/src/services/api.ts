import { apiRequest, msalInstance } from "@/lib/auth/authConfig";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface RequestOptions extends RequestInit {
  anonymous?: boolean;
}

// Acquires an access token silently; if that fails (consent needed, expired)
// triggers a redirect to Azure AD. The redirect flow means execution will not
// return — the page restarts after the user authenticates.
async function getAccessToken(): Promise<string> {
  const account = msalInstance.getActiveAccount();
  if (!account) throw new Error("No active account. Sign in first.");

  try {
    const result = await msalInstance.acquireTokenSilent({ ...apiRequest, account });
    return result.accessToken;
  } catch {
    // acquireTokenRedirect navigates away; this throw is never reached but
    // satisfies the Promise<string> return type for the compiler.
    await msalInstance.acquireTokenRedirect({ ...apiRequest, account });
    throw new Error("Redirecting to sign in…");
  }
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { anonymous, headers, ...rest } = opts;
  const token = anonymous ? undefined : await getAccessToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  // 204 No Content (e.g. DELETE) and empty bodies have nothing to parse.
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};
