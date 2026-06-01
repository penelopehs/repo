// API service abstraction — Azure Web App / Functions ready.
// Centralize fetch calls here so the UI never hits URLs directly.

import { useAuthStore } from "@/store/authStore";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface RequestOptions extends RequestInit {
  token?: string;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { token: explicit, headers, ...rest } = opts;
  const token = explicit ?? useAuthStore.getState().token ?? undefined;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};
