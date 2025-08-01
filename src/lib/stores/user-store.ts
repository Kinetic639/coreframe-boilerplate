import { create } from "zustand";
import type { User, UserPreferences, UserRoleFromToken } from "@/lib/types/user";

type UserStore = {
  user: User | null;
  preferences: UserPreferences | null;
  roles: UserRoleFromToken[];
  permissions: string[]; // 🆕 Dodane
  isLoaded: boolean;

  setContext: (ctx: {
    user: User;
    preferences: UserPreferences;
    roles: UserRoleFromToken[];
    permissions: string[]; // 🆕 Dodane
  }) => void;

  clear: () => void;
};

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  preferences: null,
  roles: [],
  permissions: [], // 🆕 Dodane
  isLoaded: false,

  setContext: ({ user, preferences, roles, permissions }) =>
    set({ user, preferences, roles, permissions, isLoaded: true }),

  clear: () => set({ user: null, preferences: null, roles: [], permissions: [], isLoaded: false }),
}));
