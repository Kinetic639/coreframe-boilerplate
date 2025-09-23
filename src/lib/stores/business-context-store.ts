import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { TemplateContext } from "@/modules/warehouse/types/flexible-products";

// Business context for the flexible product system
export type BusinessContext = TemplateContext;

interface BusinessContextState {
  // Current active context
  currentContext: BusinessContext;

  // Available contexts for the current user/organization
  availableContexts: BusinessContext[];

  // Context-specific settings
  contextSettings: Record<
    BusinessContext,
    {
      name: string;
      description: string;
      color: string;
      icon: string;
      enabled: boolean;
    }
  >;

  // Loading state
  isLoadingContexts: boolean;

  // Error state
  contextError: string | null;
}

interface BusinessContextActions {
  // Context management
  setCurrentContext: (context: BusinessContext) => void;
  loadAvailableContexts: (organizationId: string) => Promise<void>;

  // Context configuration
  updateContextSettings: (
    context: BusinessContext,
    settings: Partial<BusinessContextState["contextSettings"][BusinessContext]>
  ) => void;
  toggleContextEnabled: (context: BusinessContext) => void;

  // Utility actions
  clearError: () => void;
  reset: () => void;
}

// Default context configurations
const DEFAULT_CONTEXT_SETTINGS: BusinessContextState["contextSettings"] = {
  warehouse: {
    name: "Warehouse",
    description: "Internal warehouse management",
    color: "#10b981", // green
    icon: "Warehouse",
    enabled: true,
  },
  ecommerce: {
    name: "E-commerce",
    description: "Online store product management",
    color: "#3b82f6", // blue
    icon: "ShoppingCart",
    enabled: false,
  },
  b2b: {
    name: "B2B Catalog",
    description: "Business-to-business product catalog",
    color: "#f59e0b", // amber
    icon: "Building2",
    enabled: false,
  },
  pos: {
    name: "Point of Sale",
    description: "Point of sale system",
    color: "#ef4444", // red
    icon: "CreditCard",
    enabled: false,
  },
  manufacturing: {
    name: "Manufacturing",
    description: "Manufacturing and production",
    color: "#8b5cf6", // purple
    icon: "Factory",
    enabled: false,
  },
};

const initialState: BusinessContextState = {
  currentContext: "warehouse",
  availableContexts: ["warehouse"],
  contextSettings: DEFAULT_CONTEXT_SETTINGS,
  isLoadingContexts: false,
  contextError: null,
};

export const useBusinessContextStore = create<BusinessContextState & BusinessContextActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ===== CONTEXT MANAGEMENT =====

      setCurrentContext: (context: BusinessContext) => {
        const { contextSettings } = get();

        // Validate that the context is available and enabled
        if (!contextSettings[context].enabled) {
          set({ contextError: `Context '${context}' is not enabled` });
          return;
        }

        set({
          currentContext: context,
          contextError: null,
        });

        // Store in localStorage for persistence
        try {
          localStorage.setItem("business-context", context);
        } catch (error) {
          console.warn("Could not save context to localStorage:", error);
        }
      },

      loadAvailableContexts: async (_organizationId: string) => {
        set({ isLoadingContexts: true, contextError: null });

        try {
          // TODO: In a real implementation, this would query the organization's
          // enabled contexts from the database. For now, we'll use a default set.

          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Default contexts for all organizations (can be customized per org)
          const availableContexts: BusinessContext[] = ["warehouse", "ecommerce", "b2b", "pos"];

          // Load from localStorage if available
          let savedContext: BusinessContext = "warehouse";
          try {
            const stored = localStorage.getItem("business-context") as BusinessContext;
            if (stored && availableContexts.includes(stored)) {
              savedContext = stored;
            }
          } catch (error) {
            console.warn("Could not load context from localStorage:", error);
          }

          set({
            availableContexts,
            currentContext: savedContext,
            isLoadingContexts: false,
          });
        } catch (error) {
          console.error("Error loading available contexts:", error);
          set({
            contextError: error instanceof Error ? error.message : "Failed to load contexts",
            isLoadingContexts: false,
          });
        }
      },

      // ===== CONTEXT CONFIGURATION =====

      updateContextSettings: (context: BusinessContext, settings) => {
        set((state) => ({
          contextSettings: {
            ...state.contextSettings,
            [context]: {
              ...state.contextSettings[context],
              ...settings,
            },
          },
        }));
      },

      toggleContextEnabled: (context: BusinessContext) => {
        set((state) => {
          const isCurrentlyEnabled = state.contextSettings[context].enabled;
          const newEnabled = !isCurrentlyEnabled;

          // If we're disabling the current context, switch to warehouse
          const newCurrentContext =
            context === state.currentContext && !newEnabled ? "warehouse" : state.currentContext;

          return {
            contextSettings: {
              ...state.contextSettings,
              [context]: {
                ...state.contextSettings[context],
                enabled: newEnabled,
              },
            },
            currentContext: newCurrentContext,
            availableContexts: newEnabled
              ? [...state.availableContexts, context].filter((c, i, arr) => arr.indexOf(c) === i)
              : state.availableContexts.filter((c) => c !== context),
          };
        });
      },

      // ===== UTILITY ACTIONS =====

      clearError: () => {
        set({ contextError: null });
      },

      reset: () => {
        set(initialState);

        // Clear localStorage
        try {
          localStorage.removeItem("business-context");
        } catch (error) {
          console.warn("Could not clear context from localStorage:", error);
        }
      },
    }),
    {
      name: "business-context-store",
    }
  )
);
