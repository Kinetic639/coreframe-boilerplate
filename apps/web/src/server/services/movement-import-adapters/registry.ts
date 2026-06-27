import type { MovementImportSource } from "@/lib/warehouse/inventory-types";
import { svwmsWddMatcherMovementImportAdapter } from "./svwms-wdd-matcher.adapter";
import type { MovementImportSourceAdapter } from "./types";

const adapters: MovementImportSourceAdapter[] = [svwmsWddMatcherMovementImportAdapter];

export class MovementImportSourceRegistry {
  static listAdapters(movementTypeCode?: string): MovementImportSourceAdapter[] {
    return adapters.filter((adapter) => {
      if (!movementTypeCode) return true;
      return adapter.supportedMovementTypeCodes.includes(movementTypeCode);
    });
  }

  static listSources(movementTypeCode?: string): MovementImportSource[] {
    return this.listAdapters(movementTypeCode).map((adapter) => ({
      source_type: adapter.sourceType,
      label: adapter.label,
      description: adapter.description,
      supported_movement_type_codes: adapter.supportedMovementTypeCodes,
      input_fields: adapter.inputFields,
    }));
  }

  static getAdapter(sourceType: string): MovementImportSourceAdapter | null {
    return adapters.find((adapter) => adapter.sourceType === sourceType) ?? null;
  }
}

export type { MovementImportSourceAdapter } from "./types";
