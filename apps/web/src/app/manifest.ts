import type { MetadataRoute } from "next";

// Not locale-scoped (this route lives outside the [locale] segment, so there's no
// request-time locale to translate against) — kept intentionally static/bilingual-neutral.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ambra — Warehouse & Business Management Platform",
    short_name: "Ambra",
    description:
      "Enterprise-grade SaaS platform for warehouse management, inventory tracking, and business operations.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#10b981",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/branding/ambra-crystal-floating.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
