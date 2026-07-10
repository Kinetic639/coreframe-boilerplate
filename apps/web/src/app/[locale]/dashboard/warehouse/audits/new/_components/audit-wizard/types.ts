export interface WizardLocationOption {
  id: string;
  name: string;
  code: string | null;
  parent_id: string | null;
  level: number;
}

export interface WizardSupplierOption {
  id: string;
  name: string;
}
