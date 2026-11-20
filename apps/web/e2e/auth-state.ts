import { fileURLToPath } from "node:url";

/**
 * E2E test account credentials. Set in .env.local (gitignored) as
 * E2E_TEST_EMAIL / E2E_TEST_PASSWORD. Authenticated specs skip themselves
 * (rather than failing) when these aren't configured, e.g. in CI until
 * secrets are wired up.
 */
export const E2E_TEST_EMAIL = process.env.E2E_TEST_EMAIL;
export const E2E_TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

/** Session saved by auth.setup.ts, shared by the authenticated specs. Gitignored. */
export const AUTH_STATE_FILE = fileURLToPath(new URL("./.auth/user.json", import.meta.url));
