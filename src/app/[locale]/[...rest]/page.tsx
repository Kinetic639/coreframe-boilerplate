import { notFound } from "next/navigation";

/**
 * Catch-all route at locale level
 *
 * Required for next-intl to properly render not-found.tsx with locale context.
 * This catches unknown routes and immediately calls notFound() to trigger
 * the appropriate segment-level not-found.tsx (dashboard or public).
 *
 * This is ONLY used for unknown routes - specific segments like /dashboard/*
 * still take priority due to static route matching.
 */
export default function LocaleCatchAll() {
  notFound();
}
