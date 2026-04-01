/**
 * Actor Display Enrichment — DEPRECATED
 *
 * This module previously provided enrichActorDisplays(), a function that
 * resolved actor_user_id UUIDs to display names for the personal activity feed.
 *
 * It has been superseded by reference-enrichment.ts, which provides full
 * reference enrichment (actors, targets, roles, branches) for all three feed
 * types. All feed actions now use applyReferenceEnrichment() directly.
 *
 * This file is retained as an empty module to avoid import errors if referenced
 * by legacy code paths. It exports nothing and performs no DB queries.
 *
 * @see src/server/audit/reference-enrichment.ts — the authoritative enrichment layer
 */

import "server-only";
