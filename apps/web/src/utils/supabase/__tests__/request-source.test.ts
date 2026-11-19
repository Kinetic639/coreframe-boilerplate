import { describe, it, expect } from "vitest";
import { buildClientInfo, normalizeSourcePath } from "../request-source";

const h = (values: Record<string, string>) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
});

describe("normalizeSourcePath", () => {
  it("keeps the path, drops origin and query, masks ids", () => {
    expect(
      normalizeSourcePath(
        "https://app.example.com/pl/dashboard/planning/3282eefa-5f29-4f60-9143-97ad3111dfc3?tab=1"
      )
    ).toBe("/pl/dashboard/planning/:id");
  });

  it("returns - for a missing value", () => {
    expect(normalizeSourcePath(null)).toBe("-");
  });
});

describe("buildClientInfo", () => {
  it("labels a server action with its id and page", () => {
    expect(
      buildClientInfo(
        h({
          "next-action": "7f3a9c00e1b2d3c4f5a6b7c8",
          referer: "https://x.dev/pl/dashboard/start",
        })
      )
    ).toBe("ambra-web; kind=action; action=7f3a9c00e1b2d3c4; page=/pl/dashboard/start");
  });

  it("labels a client navigation", () => {
    expect(buildClientInfo(h({ rsc: "1", "next-url": "/pl/dashboard/planning" }))).toBe(
      "ambra-web; kind=rsc; from=/pl/dashboard/planning"
    );
  });

  it("labels a full page request", () => {
    expect(buildClientInfo(h({}))).toBe("ambra-web; kind=page");
  });

  it("never lets header text break the label", () => {
    expect(buildClientInfo(h({ "next-action": "ab;cd ef=gh" }))).toBe(
      "ambra-web; kind=action; action=abcdefgh; page=-"
    );
  });
});
