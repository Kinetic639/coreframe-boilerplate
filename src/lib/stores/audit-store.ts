import { create } from "zustand";
import { Audit, AuditItem, AuditProgress } from "@/lib/types/audit";

interface AuditState {
  currentAudit: Audit | null;
  auditProgress: AuditProgress | null;
  auditItems: AuditItem[];
  auditProducts: any[];

  startAudit: (audit: Audit, products: any[]) => void;
  updateProgress: (progress: Partial<AuditProgress>) => void;
  addCorrection: (item: AuditItem) => void;
  completeAudit: () => void;
  cancelAudit: () => void;
  resetAudit: () => void;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  currentAudit: null,
  auditProgress: null,
  auditItems: [],
  auditProducts: [],

  startAudit: (audit, products) => {
    const progress: AuditProgress = {
      currentLocationIndex: 0,
      currentProductIndex: 0,
      totalLocations: audit.location_ids.length,
      totalProducts: products.length,
      checkedProducts: 0,
      corrections: [],
    };

    set({
      currentAudit: { ...audit, status: "in_progress", started_at: new Date().toISOString() },
      auditProgress: progress,
      auditItems: [],
      auditProducts: products,
    });
  },

  updateProgress: (progressUpdate) => {
    set((state) => ({
      auditProgress: state.auditProgress ? { ...state.auditProgress, ...progressUpdate } : null,
    }));
  },

  addCorrection: (item) => {
    set((state) => ({
      auditItems: [...state.auditItems, item],
      auditProgress: state.auditProgress
        ? {
            ...state.auditProgress,
            checkedProducts: state.auditProgress.checkedProducts + 1,
            corrections: [...state.auditProgress.corrections, item],
          }
        : null,
    }));
  },

  completeAudit: () => {
    const state = get();
    if (state.currentAudit) {
      const completedAudit = {
        ...state.currentAudit,
        status: "completed" as const,
        completed_at: new Date().toISOString(),
        checked_products: state.auditProgress?.checkedProducts || 0,
        corrections_count: state.auditItems.length,
        total_value_change: state.auditItems.reduce((sum, item) => sum + item.value_change, 0),
      };

      set({
        currentAudit: completedAudit,
      });
    }
  },

  cancelAudit: () => {
    set((state) => ({
      currentAudit: state.currentAudit ? { ...state.currentAudit, status: "cancelled" } : null,
    }));
  },

  resetAudit: () => {
    set({
      currentAudit: null,
      auditProgress: null,
      auditItems: [],
      auditProducts: [],
    });
  },
}));
