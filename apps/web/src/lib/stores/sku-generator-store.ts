// =============================================
// SKU Generator Store
// Zustand store for SKU generator state (reusable across app)
// =============================================

import { create } from "zustand";
import type { SKUGeneratorConfig } from "@/modules/warehouse/types/product-groups";
import { variantGenerationService } from "@/modules/warehouse/api/variant-generation-service";

interface SKUGeneratorState {
  config: SKUGeneratorConfig;
  previewSKU: string;
  isOpen: boolean;

  // Actions
  setConfig: (updates: Partial<SKUGeneratorConfig>) => void;
  updateAttributeConfig: (
    attributeName: string,
    updates: Partial<SKUGeneratorConfig["includeAttributes"][0]>
  ) => void;
  generatePreview: (
    baseName: string,
    sampleAttributes: Array<{ name: string; value: string }>
  ) => void;
  reset: () => void;
  open: () => void;
  close: () => void;
}

const defaultConfig: SKUGeneratorConfig = {
  includeBaseName: true,
  baseNameFormat: "first",
  baseNameCase: "upper",
  includeAttributes: [],
  separator: "-",
};

export const useSKUGeneratorStore = create<SKUGeneratorState>((set, get) => ({
  config: defaultConfig,
  previewSKU: "",
  isOpen: false,

  setConfig: (updates) => {
    set((state) => ({
      config: { ...state.config, ...updates },
    }));
  },

  updateAttributeConfig: (attributeName, updates) => {
    set((state) => {
      const attrIndex = state.config.includeAttributes.findIndex(
        (a) => a.attributeName === attributeName
      );

      if (attrIndex === -1) return state;

      const newIncludeAttributes = [...state.config.includeAttributes];
      newIncludeAttributes[attrIndex] = {
        ...newIncludeAttributes[attrIndex],
        ...updates,
      };

      return {
        config: {
          ...state.config,
          includeAttributes: newIncludeAttributes,
        },
      };
    });
  },

  generatePreview: (baseName, sampleAttributes) => {
    const { config } = get();
    const preview = variantGenerationService.generateSKU(baseName, sampleAttributes, config);
    set({ previewSKU: preview });
  },

  reset: () => {
    set({ config: defaultConfig, previewSKU: "", isOpen: false });
  },

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
