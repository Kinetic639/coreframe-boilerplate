import { APP_VERSION, formatVersion } from "@repo/app-version";

/**
 * The version and commit this build was made from (next.config.ts sets both when the app
 * is built). Without a build (tests, some local runs) the version falls back to the one in
 * the repository and the commit is unknown.
 */
export const BUILD_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION || APP_VERSION;
export const BUILD_COMMIT: string | null = process.env.NEXT_PUBLIC_COMMIT_SHA || null;

/** "1.4.0 (a1b2c3d)": what reports and the sidebar show. */
export const BUILD_VERSION_LABEL = formatVersion(BUILD_VERSION, BUILD_COMMIT);
