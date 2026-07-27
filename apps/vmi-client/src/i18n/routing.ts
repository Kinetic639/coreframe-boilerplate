import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "pl"],
  defaultLocale: "pl",
  localePrefix: "as-needed",
  localeCookie: {
    domain: process.env.NEXT_PUBLIC_LOCALE_COOKIE_DOMAIN,
    sameSite: "lax",
  },
  pathnames: {
    "/": "/",
    "/sign-in": "/sign-in",
    "/portal": "/portal",
    "/portal/vendors": "/portal/vendors",
    "/portal/vendors/[vendorId]": "/portal/vendors/[vendorId]",
    "/portal/vendors/[vendorId]/[tab]": "/portal/vendors/[vendorId]/[tab]",
    "/inventory": "/inventory",
    "/orders": "/orders",
    "/proposals": "/proposals",
    "/messages": "/messages",
    "/settings": "/settings",
    "/stock-counts": "/stock-counts",
  },
});

export type Pathnames = keyof typeof routing.pathnames;
export type Locale = (typeof routing.locales)[number];

export default routing;
