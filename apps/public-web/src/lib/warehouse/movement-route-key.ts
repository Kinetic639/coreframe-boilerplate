export function toMovementRouteKey(displayNumber: string): string {
  return displayNumber
    .trim()
    .toUpperCase()
    .replace(/[/\\]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export function getMovementDisplayNumber(movement: {
  status: string;
  document_number: string | null;
  draft_number: string | null;
}): string {
  if (movement.status === "posted" && movement.document_number) {
    return movement.document_number;
  }
  return movement.draft_number ?? "";
}

export function getMovementRouteKey(movement: {
  status: string;
  document_number: string | null;
  draft_number: string | null;
  route_key?: string | null;
}): string {
  if (movement.route_key) return movement.route_key;
  return toMovementRouteKey(getMovementDisplayNumber(movement));
}

export function getMovementDetailHref(movement: {
  status: string;
  document_number: string | null;
  draft_number: string | null;
  route_key?: string | null;
}) {
  return {
    pathname: "/dashboard/warehouse/inventory/movements/[movementId]" as const,
    params: { movementId: getMovementRouteKey(movement) },
  };
}
