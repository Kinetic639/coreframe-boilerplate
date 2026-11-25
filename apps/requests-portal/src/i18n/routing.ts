import { defineRouting } from "next-intl/routing";
import { baseRoutingConfig } from "@repo/i18n/config";

export const routing = defineRouting({
  ...baseRoutingConfig,
  pathnames: {
    "/": "/",
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
