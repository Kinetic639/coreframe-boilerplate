import { create } from "zustand";
import type { User, UserPreferences, UserRole } from "@/lib/types/user";

type UserStore = {
  user: User | null;
  preferences: UserPreferences | null;
  roles: UserRole[];
  isLoaded: boolean;

  setContext: (ctx: { user: User; preferences: UserPreferences; roles: UserRole[] }) => void;
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
