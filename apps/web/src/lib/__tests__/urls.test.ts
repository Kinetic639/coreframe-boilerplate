import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfiguredAppUrl, getMarketingSiteUrl, getTrustedRequestOrigin } from "../urls";

function headers(values: Record<string, string>) {
  return {
    get(name: string) {
      return values[name] ?? null;
    },
  };
}

describe("URL configuration helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the local request origin for app callbacks outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.ambra-system.com");

    const origin = getTrustedRequestOrigin(
      headers({ origin: "http://127.0.0.1:3001", host: "127.0.0.1:3001" })
    );

    expect(origin).toBe("http://127.0.0.1:3001");
  });

  it("uses configured app URL in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.ambra-system.com/");

    const origin = getTrustedRequestOrigin(
      headers({ origin: "http://127.0.0.1:3001", host: "127.0.0.1:3001" })
    );

    expect(origin).toBe("https://app.ambra-system.com");
  });

  it("separates app and marketing URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3001/");
    vi.stubEnv("NEXT_PUBLIC_MARKETING_SITE_URL", "https://www.ambra-system.com/");

    expect(getConfiguredAppUrl()).toBe("http://127.0.0.1:3001");
    expect(getMarketingSiteUrl()).toBe("https://www.ambra-system.com");
  });
});
