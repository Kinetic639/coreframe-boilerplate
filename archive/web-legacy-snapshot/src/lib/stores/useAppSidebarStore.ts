import { create } from "zustand";

interface AppSidebarState {
  // Add other states here that the store will manage
}

export const useAppSidebarStore = create<AppSidebarState>(() => ({
  // Initialize other states here
}));
