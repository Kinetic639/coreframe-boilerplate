import type { MetadataRoute } from "next";

// Not locale-scoped (this route lives outside the [locale] segment, so there's no
// request-time locale to translate against) — kept intentionally static/bilingual-neutral.
// The window colour here is only the first paint: once a page loads,
// <ThemeColorSync> sets it to the user's light/dark and colour theme.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Ambra — Warehouse & Business Management Platform",
    short_name: "Ambra",
    description:
      "Enterprise-grade SaaS platform for warehouse management, inventory tracking, and business operations.",
    start_url: "/dashboard/start",
    scope: "/",
    display: "standalone",
    background_color: "#171717",
    theme_color: "#1f1f1f",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/pwa/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/branding/ambra-crystal-floating.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
