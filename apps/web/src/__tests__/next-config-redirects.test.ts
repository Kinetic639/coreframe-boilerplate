/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig() {
  vi.resetModules();
  return import("../../next.config");
}

describe("next.config public redirects", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses temporary public-site redirects in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_MARKETING_SITE_URL", "https://marketing.example.com");

    const { nextConfig } = await loadConfig();
    const redirects = await nextConfig.redirects();

    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/",
          destination: "/logowanie",
          permanent: false,
        }),
        expect.objectContaining({
          source: "/en",
          destination: "/en/sign-in",
          permanent: false,
        }),
        expect.objectContaining({
          source: "/features",
          destination: "https://marketing.example.com/features",
          permanent: false,
        }),
      ])
    );
  });

  it("keeps production public-site redirects permanent", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_MARKETING_SITE_URL", "https://marketing.example.com");

    const { nextConfig } = await loadConfig();
    const redirects = await nextConfig.redirects();

    expect(redirects).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/",
        }),
      ])
    );
    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/features",
          destination: "https://marketing.example.com/features",
          permanent: true,
        }),
      ])
    );
  });
});
