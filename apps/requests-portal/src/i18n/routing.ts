import { defineRouting } from "next-intl/routing";
import { baseRoutingConfig } from "@repo/i18n/config";
import { authPathnames } from "@repo/i18n/auth-pathnames";

export const routing = defineRouting({
  ...baseRoutingConfig,
  pathnames: {
    "/": "/",
    "/sign-in": authPathnames["/sign-in"],
    "/forgot-password": authPathnames["/forgot-password"],
    "/new": {
      en: "/new",
      pl: "/nowe",
    },
    "/[ticketId]": {
      en: "/[ticketId]",
      pl: "/[ticketId]",
    },
  },
});

export type Pathname = keyof typeof routing.pathnames;
