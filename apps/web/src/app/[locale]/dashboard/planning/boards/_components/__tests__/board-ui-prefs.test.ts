import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOARD_UI_PREFS,
  parseBoardUiPrefs,
  serializeBoardUiPrefs,
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
      { lastBoardId: BOARD, inboxOpen: false, collapsed: {} },
      BOARD,
      COLUMN,
      true
    );
    expect(parseBoardUiPrefs(serializeBoardUiPrefs(prefs))).toEqual(prefs);
  });

  it("drops values that are not ids", () => {
    const raw = encodeURIComponent(
      JSON.stringify({ b: "../evil", i: 1, c: { [BOARD]: [COLUMN, 5, "x"], bad: [COLUMN] } })
    );
    expect(parseBoardUiPrefs(raw)).toEqual({
      lastBoardId: null,
      inboxOpen: true,
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
});
