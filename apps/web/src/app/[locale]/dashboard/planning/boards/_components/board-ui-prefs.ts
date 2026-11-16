// What the boards page remembers per browser: the last board, the boards
// opened recently, whether the inbox is open (and its colour) and which columns are collapsed
// on each board. It lives in a
// cookie so the server renders the page the way it was left (no jump after
// load).

import { paletteColor } from "./board-colors";

export const BOARD_UI_COOKIE = "planning_boards_ui";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
/** Boards whose collapsed columns are kept; the oldest are dropped first. */
const MAX_BOARDS = 12;
/** Recently opened boards kept, newest first. */
export const MAX_RECENT_BOARDS = 6;

export interface BoardUiPrefs {
  lastBoardId: string | null;
  /** Boards opened recently, newest first. */
  recent: string[];
  inboxOpen: boolean;
  /** The inbox panel's background colour (one of BOARD_COLORS), or null. */
  inboxColor: string | null;
  collapsed: Record<string, string[]>;
}

export const DEFAULT_BOARD_UI_PREFS: BoardUiPrefs = {
  lastBoardId: null,
  recent: [],
  inboxOpen: true,
  inboxColor: null,
  collapsed: {},
};

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export function parseBoardUiPrefs(raw: string | undefined | null): BoardUiPrefs {
  if (!raw) return DEFAULT_BOARD_UI_PREFS;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as {
      b?: unknown;
      i?: unknown;
      c?: unknown;
      r?: unknown;
      x?: unknown;
    };
    const collapsed: Record<string, string[]> = {};
    if (value.c && typeof value.c === "object") {
      for (const [boardId, ids] of Object.entries(value.c as Record<string, unknown>)) {
        if (!UUID.test(boardId) || !Array.isArray(ids)) continue;
        const columnIds = ids.filter((id): id is string => typeof id === "string" && UUID.test(id));
        if (columnIds.length) collapsed[boardId] = columnIds;
      }
    }
    const recent = Array.isArray(value.r)
      ? Array.from(
          new Set(value.r.filter((id): id is string => typeof id === "string" && UUID.test(id)))
        ).slice(0, MAX_RECENT_BOARDS)
      : [];
    return {
      lastBoardId: typeof value.b === "string" && UUID.test(value.b) ? value.b : null,
      recent,
      inboxOpen: value.i !== 0,
      inboxColor: paletteColor(value.x),
      collapsed,
    };
  } catch {
    return DEFAULT_BOARD_UI_PREFS;
  }
}

export function serializeBoardUiPrefs(prefs: BoardUiPrefs): string {
  const entries = Object.entries(prefs.collapsed).filter(([, ids]) => ids.length);
  const kept = Object.fromEntries(entries.slice(-MAX_BOARDS));
  return encodeURIComponent(
    JSON.stringify({
      b: prefs.lastBoardId ?? undefined,
      i: prefs.inboxOpen ? 1 : 0,
      c: kept,
      r: prefs.recent.length ? prefs.recent.slice(0, MAX_RECENT_BOARDS) : undefined,
      x: prefs.inboxColor ?? undefined,
    })
  );
}

/** Browser only: writes the preferences back to the cookie. */
export function writeBoardUiPrefs(prefs: BoardUiPrefs) {
  document.cookie = `${BOARD_UI_COOKIE}=${serializeBoardUiPrefs(prefs)}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}

/** Collapsing or expanding a column; the board moves to the end (most recent). */
export function withColumnCollapsed(
  prefs: BoardUiPrefs,
  boardId: string,
  columnId: string,
  collapsed: boolean
): BoardUiPrefs {
  const current = prefs.collapsed[boardId] ?? [];
  const next = collapsed
    ? Array.from(new Set([...current, columnId]))
    : current.filter((id) => id !== columnId);
  const rest = Object.fromEntries(Object.entries(prefs.collapsed).filter(([id]) => id !== boardId));
  return { ...prefs, collapsed: next.length ? { ...rest, [boardId]: next } : rest };
}

/** A board was opened: it becomes the last board and goes to the front of the recent list. */
export function withBoardOpened(prefs: BoardUiPrefs, boardId: string): BoardUiPrefs {
  if (prefs.lastBoardId === boardId && prefs.recent[0] === boardId) return prefs;
  return {
    ...prefs,
    lastBoardId: boardId,
    recent: [boardId, ...prefs.recent.filter((id) => id !== boardId)].slice(0, MAX_RECENT_BOARDS),
  };
}
