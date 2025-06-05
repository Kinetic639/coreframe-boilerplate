// lib/stores/user-store.ts
import { create } from "zustand";
import type { User, Role, UserPreferences } from "@/lib/types/user";

type UserStore = {
  user: User | null;
  preferences: UserPreferences | null;
  roles: Role[];
  isLoaded: boolean;

  setContext: (data: { user: User; preferences: UserPreferences; roles: Role[] }) => void;

  clear: () => void;
};

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  preferences: null,
  roles: [],
  isLoaded: false,

  setContext: (ctx) => {
    console.log("💾 zapisuję w Zustand:", ctx);
    set({ user: ctx.user, preferences: ctx.preferences, roles: ctx.roles });
  },

  clear: () => set({ user: null, preferences: null, roles: [], isLoaded: false }),
}));
