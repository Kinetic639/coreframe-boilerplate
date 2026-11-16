import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOARD_UI_PREFS,
  parseBoardUiPrefs,
  MAX_RECENT_BOARDS,
  serializeBoardUiPrefs,
  withBoardOpened,
  withColumnCollapsed,
} from "../board-ui-prefs";

const BOARD = "11111111-1111-4111-8111-111111111111";
const COLUMN = "22222222-2222-4222-8222-222222222222";

describe("board UI prefs", () => {
  it("falls back to defaults for a missing or broken cookie", () => {
    expect(parseBoardUiPrefs(undefined)).toEqual(DEFAULT_BOARD_UI_PREFS);
    expect(parseBoardUiPrefs("not json")).toEqual(DEFAULT_BOARD_UI_PREFS);
  });

  it("round-trips through the cookie", () => {
    const prefs = withColumnCollapsed(
      {
        lastBoardId: BOARD,
        recent: [BOARD],
        inboxOpen: false,
        inboxColor: "#0079bf",
        collapsed: {},
      },
      BOARD,
      COLUMN,
      true
    );
    expect(parseBoardUiPrefs(serializeBoardUiPrefs(prefs))).toEqual(prefs);
  });

  it("drops values that are not ids", () => {
    const raw = encodeURIComponent(
      JSON.stringify({
        b: "../evil",
        i: 1,
        x: "red;background:url(x)",
        c: { [BOARD]: [COLUMN, 5, "x"], bad: [COLUMN] },
      })
    );
    expect(parseBoardUiPrefs(raw)).toEqual({
      lastBoardId: null,
      recent: [],
      inboxOpen: true,
      inboxColor: null,
      collapsed: { [BOARD]: [COLUMN] },
    });
  });

  it("expands a column and forgets a board with nothing collapsed", () => {
    const collapsed = withColumnCollapsed(DEFAULT_BOARD_UI_PREFS, BOARD, COLUMN, true);
    expect(collapsed.collapsed[BOARD]).toEqual([COLUMN]);
    const expanded = withColumnCollapsed(collapsed, BOARD, COLUMN, false);
    expect(expanded.collapsed).toEqual({});
  });

  it("keeps only the most recent boards", () => {
    let prefs = DEFAULT_BOARD_UI_PREFS;
    for (let index = 0; index < 15; index += 1) {
      const board = `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`;
      prefs = withColumnCollapsed(prefs, board, COLUMN, true);
    }
    const kept = Object.keys(parseBoardUiPrefs(serializeBoardUiPrefs(prefs)).collapsed);
    expect(kept).toHaveLength(12);
    expect(kept).not.toContain("00000000-1111-4111-8111-111111111111");
  });

  it("puts an opened board first in the recent list, without repeats", () => {
    const other = "33333333-3333-4333-8333-333333333333";
    let prefs = withBoardOpened(DEFAULT_BOARD_UI_PREFS, BOARD);
    prefs = withBoardOpened(prefs, other);
    prefs = withBoardOpened(prefs, BOARD);
    expect(prefs.lastBoardId).toBe(BOARD);
    expect(prefs.recent).toEqual([BOARD, other]);
    expect(withBoardOpened(prefs, BOARD)).toBe(prefs);
  });

  it("keeps only the last few opened boards", () => {
    let prefs = DEFAULT_BOARD_UI_PREFS;
    for (let index = 0; index < 10; index += 1) {
      prefs = withBoardOpened(
        prefs,
        `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`
      );
    }
    const parsed = parseBoardUiPrefs(serializeBoardUiPrefs(prefs));
    expect(parsed.recent).toHaveLength(MAX_RECENT_BOARDS);
    expect(parsed.recent[0]).toBe("00000009-1111-4111-8111-111111111111");
  });
});
