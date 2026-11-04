/**
 * The URL form of a document number: slashes become hyphens, the rest is kept
 * -- also the brackets and the sign of AutoStacja numbers:
 * PZ(115)/1/26/3112 -> PZ(115)-1-26-3112, MMJ-(115)/2/26/3112 -> MMJ-(115)-2-26-3112.
 * Hyphens are not merged, so MMJ- and MMJ+ numbers stay apart.
 */
export function toMovementRouteKey(displayNumber: string): string {
  return displayNumber
    .trim()
    .toUpperCase()
    .replace(/[/\\]/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The route key as it came in: a "+" in a query string may arrive as a space.
 */
export function normalizeMovementRouteKey(identifier: string): string {
  return identifier.trim().toUpperCase().replace(/ /g, "+");
}

/**
 * A LIKE pattern matching the document number a route key was made from: each
 * hyphen (a slash or a hyphen in the number) matches one character.
 */
export function movementRouteKeyPattern(identifier: string): string {
  return normalizeMovementRouteKey(identifier)
    .replace(/[^A-Z0-9()+-]/g, "")
    .replace(/-/g, "_");
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
