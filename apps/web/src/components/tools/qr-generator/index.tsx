"use client";

import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { ListLoading } from "@/components/data-table/list-loading";
import { QrLabelGenerator } from "./qr-label-generator";

/**
 * QR Label Generator -- registered in the tool registry under "qr-generator"
 * (slug kept so nobody loses the enabled tool). Label templates and blank
 * label printing; the codes themselves are managed in Organization → QR codes.
 */
export function QrGeneratorTool() {
  const activeOrgId = useAppStoreV2((state) => state.activeOrgId);
  if (!activeOrgId) return <ListLoading actions={2} columns={4} tabs={0} />;
  return <QrLabelGenerator key={activeOrgId} orgId={activeOrgId} />;
}
