// Frontend-only mock auth store — Azure AD ready replacement.

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  username: string;
  displayName: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: async (username, password) => {
        await new Promise((r) => setTimeout(r, 700));
        if (!username || password.length < 4) throw new Error("Invalid credentials");
        set({
          user: { username, displayName: username },
          token: `mock_${Date.now()}`,
          isAuthenticated: true,
        });
      },
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    { name: "crm-auth" },
  ),
);
