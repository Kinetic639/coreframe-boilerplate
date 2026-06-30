import {
  PRIMARY_FIELD_KEY,
  SECONDARY_FIELD_KEY,
  TOKEN_FIELD_KEY,
  SCAN_URL_FIELD_KEY,
} from "@/lib/qr/label-config";
import type { LabelDesignerField } from "@/app/[locale]/dashboard/qr/_components/label-designer";

/** Data fields a location label's text lines can be bound to. */
export function getLocationLabelFields(t: (key: string) => string): LabelDesignerField[] {
  return [
    { key: PRIMARY_FIELD_KEY, label: t("fields.locationName") },
    { key: SECONDARY_FIELD_KEY, label: t("fields.locationCode") },
    { key: TOKEN_FIELD_KEY, label: t("fields.qrToken") },
    { key: SCAN_URL_FIELD_KEY, label: t("fields.scanUrl") },
  ];
}
