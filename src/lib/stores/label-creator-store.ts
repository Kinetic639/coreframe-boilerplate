import { create } from "zustand";
import { LabelTemplate, LabelTemplateField } from "@/lib/types/qr-system";
import { v4 as uuidv4 } from "uuid";

interface LabelCreatorState {
  // Current template being edited
  currentTemplate: LabelTemplate;

  // UI state
  selectedField: LabelTemplateField | null;
  viewMode: "edit" | "preview";
  isCustomSize: boolean;
  generationDialogOpen: boolean;

  // Loading states
  isLoadingTemplate: boolean;
  isSavingTemplate: boolean;
  originalTemplateId: string | null;
  isEditingTemplate: boolean;

  // Actions
  setCurrentTemplate: (template: LabelTemplate) => void;
  updateTemplate: (updates: Partial<LabelTemplate>) => void;
  setSelectedField: (field: LabelTemplateField | null) => void;
  setViewMode: (mode: "edit" | "preview") => void;
  setIsCustomSize: (isCustom: boolean) => void;
  setGenerationDialogOpen: (open: boolean) => void;

  // Field management
  addField: (fieldType: "text" | "blank") => void;
  updateField: (fieldId: string, updates: Partial<LabelTemplateField>) => void;
  removeField: (fieldId: string) => void;
  moveField: (fieldId: string, direction: "up" | "down") => void;

  // Template management
  resetTemplate: () => void;
  loadTemplate: (template: LabelTemplate) => void;

  // Loading states
  setLoadingStates: (states: {
    isLoadingTemplate?: boolean;
    isSavingTemplate?: boolean;
    originalTemplateId?: string | null;
    isEditingTemplate?: boolean;
  }) => void;
}

const createDefaultTemplate = (): any => ({
  id: uuidv4(),
  name: "",
  description: "",
  label_type: "generic",
  category: "medium",
  width_mm: 40,
  height_mm: 20,
  dpi: 300,
  orientation: "portrait",
  template_config: {},
  qr_position: "left",
  qr_size_mm: 15,
  show_label_text: false,
  label_text_position: "bottom",
  label_text_size: 12,
  show_code: false,
  show_additional_info: true,
  additional_info_position: "bottom",
  layout_direction: "row",
  section_balance: "equal",
  background_color: "#FFFFFF",
  text_color: "#000000",
  border_enabled: true,
  border_width: 0.5,
  border_color: "#000000",
  label_padding_top: 2,
  label_padding_right: 2,
  label_padding_bottom: 2,
  label_padding_left: 2,
  fields: [],
  is_default: false,
  is_system: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const useLabelCreatorStore = create<LabelCreatorState>((set, get) => ({
  // Initial state
  currentTemplate: createDefaultTemplate(),
  selectedField: null,
  viewMode: "edit",
  isCustomSize: false,
  generationDialogOpen: false,
  isLoadingTemplate: false,
  isSavingTemplate: false,
  originalTemplateId: null,
  isEditingTemplate: false,

  // Basic setters
  setCurrentTemplate: (template) => set({ currentTemplate: template }),
  updateTemplate: (updates) =>
    set((state) => ({
      currentTemplate: {
        ...state.currentTemplate,
        ...updates,
        updated_at: new Date().toISOString(),
      },
    })),
  setSelectedField: (field) => set({ selectedField: field }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setIsCustomSize: (isCustom) => set({ isCustomSize: isCustom }),
  setGenerationDialogOpen: (open) => set({ generationDialogOpen: open }),

  // Field management
  addField: (fieldType) => {
    const state = get();
    const fieldCount = state.currentTemplate.fields?.length || 0;
    const newFieldCount = fieldCount + 1;
    const template = state.currentTemplate;
    const qrSize = template.qr_size_mm || 15;

    // Calculate available space for fields based on QR position
    let fieldX = 2;
    let fieldY = 2;
    let fieldWidth = template.width_mm - 4;

    // Adjust position based on QR code position to avoid overlap
    if (
      template.qr_position === "left" ||
      template.qr_position === "top-left" ||
      template.qr_position === "bottom-left"
    ) {
      fieldX = qrSize + 4;
      fieldWidth = template.width_mm - qrSize - 6;
    } else if (
      template.qr_position === "right" ||
      template.qr_position === "top-right" ||
      template.qr_position === "bottom-right"
    ) {
      fieldWidth = template.width_mm - qrSize - 6;
    }

    // Stack fields vertically with proper spacing
    if (template.qr_position === "top-left" || template.qr_position === "top-right") {
      fieldY = Math.max(qrSize + 4, fieldCount * 6 + 2);
    } else if (template.qr_position === "bottom-left" || template.qr_position === "bottom-right") {
      fieldY = fieldCount * 6 + 2;
    } else {
      fieldY = fieldCount * 6 + 2;
    }

    const newField: LabelTemplateField = {
      id: uuidv4(),
      label_template_id: state.currentTemplate.id,
      field_type: fieldType,
      field_name: `Field ${newFieldCount}`,
      field_value: fieldType === "text" ? "Sample text" : null,
      position_x: fieldX,
      position_y: fieldY,
      width_mm: Math.max(fieldWidth, 10),
      height_mm: 4,
      font_size: 10,
      font_weight: "normal",
      text_align: "left",
      vertical_align: "center",
      show_label: false,
      label_text: null,
      is_required: false,
      sort_order: newFieldCount,
      text_color: "#000000",
      background_color: "transparent",
      border_enabled: false,
      border_width: 0.5,
      border_color: "#000000",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set((state) => ({
      currentTemplate: {
        ...state.currentTemplate,
        fields: [...(state.currentTemplate.fields || []), newField],
        updated_at: new Date().toISOString(),
      },
      selectedField: newField,
    }));
  },

  updateField: (fieldId, updates) => {
    set((state) => ({
      currentTemplate: {
        ...state.currentTemplate,
        fields: state.currentTemplate.fields?.map((field) =>
          field.id === fieldId
            ? { ...field, ...updates, updated_at: new Date().toISOString() }
            : field
        ),
        updated_at: new Date().toISOString(),
      },
      selectedField:
        state.selectedField?.id === fieldId
          ? { ...state.selectedField, ...updates }
          : state.selectedField,
    }));
  },

  removeField: (fieldId) => {
    set((state) => {
      const filteredFields =
        state.currentTemplate.fields?.filter((field) => field.id !== fieldId) || [];

      // Update sort_order for remaining fields
      const reorderedFields = filteredFields.map((field, index) => ({
        ...field,
        sort_order: index + 1,
        updated_at: new Date().toISOString(),
      }));

      return {
        currentTemplate: {
          ...state.currentTemplate,
          fields: reorderedFields,
          updated_at: new Date().toISOString(),
        },
        selectedField: state.selectedField?.id === fieldId ? null : state.selectedField,
      };
    });
  },

  moveField: (fieldId, direction) => {
    set((state) => {
      const fields = [...(state.currentTemplate.fields || [])];
      const fieldIndex = fields.findIndex((f) => f.id === fieldId);

      if (fieldIndex === -1) return state;

      const newIndex = direction === "up" ? fieldIndex - 1 : fieldIndex + 1;
      if (newIndex < 0 || newIndex >= fields.length) return state;

      // Swap fields
      [fields[fieldIndex], fields[newIndex]] = [fields[newIndex], fields[fieldIndex]];

      // Update sort_order
      fields.forEach((field, index) => {
        field.sort_order = index + 1;
        field.updated_at = new Date().toISOString();
      });

      return {
        currentTemplate: {
          ...state.currentTemplate,
          fields,
          updated_at: new Date().toISOString(),
        },
      };
    });
  },

  // Template management
  resetTemplate: () =>
    set({
      currentTemplate: createDefaultTemplate(),
      selectedField: null,
      viewMode: "edit",
      isCustomSize: false,
      generationDialogOpen: false,
      isLoadingTemplate: false,
      isSavingTemplate: false,
      originalTemplateId: null,
      isEditingTemplate: false,
    }),

  loadTemplate: (template) => {
    // Check if it's a custom size
    const LABEL_SIZES = [
      { name: "Mała (25×15mm)", width: 25, height: 15 },
      { name: "Średnia (40×20mm)", width: 40, height: 20 },
      { name: "Duża (50×30mm)", width: 50, height: 30 },
      { name: "Bardzo duża (70×40mm)", width: 70, height: 40 },
    ];

    const matchesStandardSize = LABEL_SIZES.some(
      (size) => size.width === template.width_mm && size.height === template.height_mm
    );

    set({
      currentTemplate: template,
      selectedField: null,
      isCustomSize: !matchesStandardSize || template.category === "custom",
      isEditingTemplate: true,
      originalTemplateId: template.id,
    });
  },

  setLoadingStates: (states) =>
    set((state) => ({
      ...state,
      ...states,
    })),
}));
