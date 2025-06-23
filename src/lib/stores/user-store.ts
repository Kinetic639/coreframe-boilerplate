import { create } from "zustand";
import type { User, UserPreferences, UserRoleFromToken } from "@/lib/types/user";

type UserStore = {
  user: User | null;
  preferences: UserPreferences | null;
  roles: UserRoleFromToken[];
  isLoaded: boolean;

  setContext: (ctx: {
    user: User;
    preferences: UserPreferences;
    roles: UserRoleFromToken[];
  }) => void;
  clear: () => void;
};

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  preferences: null,
  roles: [],
  isLoaded: false,

  setContext: ({ user, preferences, roles }) => set({ user, preferences, roles, isLoaded: true }),

  clear: () => set({ user: null, preferences: null, roles: [], isLoaded: false }),
}));
