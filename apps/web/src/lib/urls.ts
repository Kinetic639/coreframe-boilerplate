type HeaderReader = {
  get(name: string): string | null;
};

const DEFAULT_LOCAL_APP_URL = "http://127.0.0.1:3001";
const DEFAULT_MARKETING_SITE_URL = "https://www.ambra-system.com";

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

export function getConfiguredAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  return withoutTrailingSlash(isAbsoluteHttpUrl(configured) ? configured : DEFAULT_LOCAL_APP_URL);
}

export function getMarketingSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_MARKETING_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  return withoutTrailingSlash(
    isAbsoluteHttpUrl(configured) ? configured : DEFAULT_MARKETING_SITE_URL
  );
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
