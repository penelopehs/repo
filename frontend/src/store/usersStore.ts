// Users store — caches the authenticated user (me) and the full user list so
// the lead dialogs can default the salesperson to the signed-in user and offer
// the canonical user list, fetching once instead of on every dialog open.

import { create } from "zustand";
import { usersApi, type ApiUser } from "@/services/users";

interface UsersState {
  me: ApiUser | null;
  users: ApiUser[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  /** Load me + users once; safe to call repeatedly (no-op after success/in-flight). */
  ensureLoaded: () => Promise<void>;
}

export const useUsersStore = create<UsersState>((set, get) => ({
  me: null,
  users: [],
  loading: false,
  loaded: false,
  error: null,

  ensureLoaded: async () => {
    const { loaded, loading } = get();
    if (loaded || loading) return;
    set({ loading: true, error: null });
    try {
      const [me, users] = await Promise.all([usersApi.me(), usersApi.list()]);
      set({ me, users, loaded: true, loading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to load users",
        loading: false,
      });
    }
  },
}));
