import { getAppUrl } from "@repo/app-urls";

type HeaderReader = {
  get(name: string): string | null;
};

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function isAbsoluteHttpUrl(value: string | undefined): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isLocalAppOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

/** Origin of this app (the ERP). NEXT_PUBLIC_APP_URL wins, then `@repo/app-urls`. */
export function getConfiguredAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  return isAbsoluteHttpUrl(configured) ? withoutTrailingSlash(configured) : getAppUrl("erp");
}

/** The public Ambra website (apps/public-web), from `@repo/app-urls`. */
export function getMarketingSiteUrl(): string {
  return getAppUrl("site");
}

export function getTrustedRequestOrigin(headersList: HeaderReader): string {
  const configuredAppUrl = getConfiguredAppUrl();

  if (process.env.NODE_ENV === "production") {
    return configuredAppUrl;
  }

  const origin = headersList.get("origin");
  if (origin && isAbsoluteHttpUrl(origin) && isLocalAppOrigin(origin)) {
    return withoutTrailingSlash(origin);
  }

  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  if (!host) return configuredAppUrl;

  const proto =
    headersList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const requestOrigin = `${proto}://${host}`;

  if (isAbsoluteHttpUrl(requestOrigin) && isLocalAppOrigin(requestOrigin)) {
    return withoutTrailingSlash(requestOrigin);
  }

  return configuredAppUrl;
}
