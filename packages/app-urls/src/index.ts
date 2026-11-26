import { authPathnames } from "@repo/i18n/auth-pathnames";

/**
 * Where each Ambra app lives, and the one shared sign-in.
 *
 * Every app runs on its own subdomain of one registrable domain and they share
 * a single Supabase session (an auth cookie on `.ambra-system.com`). The ERP at
 * `app.` hosts the only sign-in page; any other app without a session sends the
 * user there with `returnUrl` set to where they were, and the sign-in sends them
 * back once `resolveReturnUrl` accepts that address.
 */

export type AmbraApp = "site" | "erp" | "requests" | "vmi";

export const AMBRA_APPS: readonly AmbraApp[] = ["site", "erp", "requests", "vmi"];

const PRODUCTION_URLS: Record<AmbraApp, string> = {
  site: "https://ambra-system.com",
  erp: "https://app.ambra-system.com",
  requests: "https://zapytania.ambra-system.com",
  vmi: "https://vmi.ambra-system.com",
};

// Dev ports from each app's own `dev` script. vmi-client's script also uses 3001
// (same as apps/web), so set NEXT_PUBLIC_AMBRA_VMI_URL when running both at once.
const LOCAL_URLS: Record<AmbraApp, string> = {
  site: "http://127.0.0.1:3002",
  erp: "http://127.0.0.1:3001",
  requests: "http://127.0.0.1:3004",
  vmi: "http://127.0.0.1:3003",
};

/** Name of the Supabase auth cookie, the same in every app. */
export const AUTH_COOKIE_NAME = "ambra-auth";

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function parseHttpUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

// Literal property reads: Next.js only inlines NEXT_PUBLIC_* into browser bundles
// when the full `process.env.NEXT_PUBLIC_X` expression appears in the source.
function configuredUrl(app: AmbraApp): string | undefined {
  switch (app) {
    case "site":
      return process.env.NEXT_PUBLIC_AMBRA_SITE_URL;
    case "erp":
      return process.env.NEXT_PUBLIC_AMBRA_ERP_URL;
    case "requests":
      return process.env.NEXT_PUBLIC_AMBRA_REQUESTS_URL;
    case "vmi":
      return process.env.NEXT_PUBLIC_AMBRA_VMI_URL;
  }
}

/** Origin of an Ambra app, without a trailing slash, e.g. `https://app.ambra-system.com`. */
export function getAppUrl(app: AmbraApp): string {
  const configured = parseHttpUrl(configuredUrl(app));
  if (configured) return withoutTrailingSlash(configured.origin);
  return process.env.NODE_ENV === "production" ? PRODUCTION_URLS[app] : LOCAL_URLS[app];
}

/** Absolute URL of `path` in an Ambra app. */
export function appUrl(app: AmbraApp, path = "/"): string {
  return `${getAppUrl(app)}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Domain of the shared auth cookie, e.g. `.ambra-system.com`; `undefined` means a
 * host-only cookie (local dev, where cookies are shared across ports anyway).
 */
export function getAuthCookieDomain(): string | undefined {
  const domain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim();
  return domain ? domain : undefined;
}

/** `cookieOptions` for every `createServerClient` / `createBrowserClient` in every app. */
export function getAuthCookieOptions(): {
  name: string;
  domain?: string;
  path: string;
  sameSite: "lax";
  secure: boolean;
} {
  const domain = getAuthCookieDomain();
  return {
    name: AUTH_COOKIE_NAME,
    ...(domain ? { domain } : {}),
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}

function hasUnsafeCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return character === "\\" || code < 32 || code === 127;
  });
}

/**
 * Returns the address a sign-in may send the user back to, or `null`.
 *
 * Accepts a path in the same app (`/dashboard/start`, never `//host`) or an
 * absolute URL whose origin is exactly one of the Ambra apps. Anything else
 * (another host, `javascript:`, backslashes, control characters) is refused,
 * so `returnUrl` can't be used as an open redirect.
 */
export function resolveReturnUrl(value: string | null | undefined): string | null {
  const candidate = value?.trim() ?? "";
  if (!candidate || hasUnsafeCharacters(candidate)) return null;

  if (candidate.startsWith("/")) {
    return candidate.startsWith("//") ? null : candidate;
  }

  const url = parseHttpUrl(candidate);
  if (!url) return null;
  const allowedOrigins = new Set(AMBRA_APPS.map(getAppUrl));
  return allowedOrigins.has(url.origin) ? url.toString() : null;
}

/** True when `returnUrl` is an absolute URL pointing at a different origin than `currentOrigin`. */
export function isCrossAppReturnUrl(returnUrl: string, currentOrigin: string): boolean {
  if (returnUrl.startsWith("/")) return false;
  const url = parseHttpUrl(returnUrl);
  return url !== null && url.origin !== withoutTrailingSlash(currentOrigin);
}

function localizedAuthPath(page: "/sign-in" | "/sign-up", locale: "pl" | "en"): string {
  return locale === "en" ? `/en${authPathnames[page].en}` : authPathnames[page].pl;
}

/**
 * The shared sign-in page (in the ERP), sending the user back to `returnUrl`
 * afterwards. `returnUrl` should be absolute when called from another app.
 */
export function buildSignInUrl(returnUrl?: string | null, locale: "pl" | "en" = "pl"): string {
  const url = new URL(appUrl("erp", localizedAuthPath("/sign-in", locale)));
  const safe = resolveReturnUrl(returnUrl);
  if (safe) url.searchParams.set("returnUrl", safe);
  return url.toString();
}

/** The sign-up page (in the ERP). */
export function buildSignUpUrl(locale: "pl" | "en" = "pl"): string {
  return appUrl("erp", localizedAuthPath("/sign-up", locale));
}

// ---------------------------------------------------------------------------
// Which app to open after sign-in
// ---------------------------------------------------------------------------

/** Apps a user is granted (the public site is open to everyone). */
export type AmbraWorkApp = Exclude<AmbraApp, "site">;

export const AMBRA_WORK_APPS: readonly AmbraWorkApp[] = ["erp", "requests", "vmi"];

export function isAmbraWorkApp(value: unknown): value is AmbraWorkApp {
  return typeof value === "string" && (AMBRA_WORK_APPS as readonly string[]).includes(value);
}

/** Cookie holding the app the user last worked in, shared by all apps. */
export const LAST_APP_COOKIE = "ambra-last-app";
/** Cookie set when the user wants the last app opened straight after sign-in. */
export const OPEN_LAST_APP_COOKIE = "ambra-open-last-app";

/** Options for the shared preference cookies above (readable by every app, a year long). */
export function getSharedCookieOptions(): {
  domain?: string;
  path: string;
  sameSite: "lax";
  secure: boolean;
  maxAge: number;
} {
  const domain = getAuthCookieDomain();
  return {
    ...(domain ? { domain } : {}),
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  };
}

/** Where an app starts, e.g. the ERP's `/dashboard/start`. */
export function appHomeUrl(app: AmbraWorkApp, locale: "pl" | "en" = "pl"): string {
  const prefix = locale === "en" ? "/en" : "";
  if (app === "erp") return appUrl(app, `${prefix}/dashboard/start`);
  return appUrl(app, prefix || "/");
}

/** The app chooser shown after sign-in (in the ERP). */
export function buildAppChooserUrl(locale: "pl" | "en" = "pl"): string {
  return appUrl("erp", locale === "en" ? "/en/apps" : "/aplikacje");
}

export type LandingDecision =
  | { kind: "none" }
  | { kind: "open"; app: AmbraWorkApp }
  | { kind: "choose"; lastApp: AmbraWorkApp | null };

/**
 * What to show after sign-in when there is no return address: nothing to open,
 * straight into the only app (or the last one, if the user asked for that), or
 * the chooser.
 */
export function decideLanding(
  apps: readonly AmbraWorkApp[],
  options: { lastApp?: string | null; openLast?: boolean } = {}
): LandingDecision {
  if (apps.length === 0) return { kind: "none" };
  const [onlyApp] = apps;
  if (apps.length === 1 && onlyApp) return { kind: "open", app: onlyApp };
  const lastApp =
    isAmbraWorkApp(options.lastApp) && apps.includes(options.lastApp) ? options.lastApp : null;
  if (lastApp && options.openLast) return { kind: "open", app: lastApp };
  return { kind: "choose", lastApp };
}
