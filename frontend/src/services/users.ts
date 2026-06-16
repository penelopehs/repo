// Users API service — the authenticated user (GET /users/me, which also
// provisions the row on first call) and the full user list (GET /users/) used
// to populate the salesperson dropdown.

import { api } from "@/services/api";

export interface ApiUser {
  iduser: number;
  azure_ad_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

/** Display name for a user row (e.g. the salesperson dropdown). */
export function userFullName(u: ApiUser): string {
  return `${u.first_name} ${u.last_name}`.trim();
}

export const usersApi = {
  me: () => api.get<ApiUser>("/users/me"),
  list: () => api.get<ApiUser[]>("/users/"),
};
