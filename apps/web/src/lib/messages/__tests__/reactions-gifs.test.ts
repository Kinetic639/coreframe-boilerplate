import { describe, expect, it } from "vitest";
import { applyReaction, setMessageReactions, type MessagesInfiniteData } from "../cache";
import { fitGif, gifToMedia, isAllowedGifUrl, parseGifResponse } from "../gif";
import { isEmojiOnly } from "@/components/v2/messages/chat-message-parts";
import type { ChatMessage } from "../types";

describe("applyReaction", () => {
  it("adds a user to an emoji and keeps the order", () => {
    expect(applyReaction({ "👍": ["a"] }, "👍", "b", true)).toEqual({ "👍": ["a", "b"] });
    expect(applyReaction(null, "❤️", "a", true)).toEqual({ "❤️": ["a"] });
  });

  it("is idempotent and drops an emoji nobody uses any more", () => {
    const same = { "👍": ["a"] };
    expect(applyReaction(same, "👍", "a", true)).toBe(same);
    expect(applyReaction(same, "👍", "b", false)).toBe(same);
    expect(applyReaction({ "👍": ["a"], "😂": ["b"] }, "👍", "a", false)).toEqual({ "😂": ["b"] });
  });
});

describe("setMessageReactions", () => {
  const msg = { id: "m1", reactions: {} } as unknown as ChatMessage;
  const data: MessagesInfiniteData = {
    pages: [{ messages: [msg], nextCursor: null }],
    pageParams: [null],
  };

  it("changes only the loaded message", () => {
    const next = setMessageReactions(data, "m1", (r) => applyReaction(r, "🙏", "u", true));
    expect(next?.pages[0].messages[0].reactions).toEqual({ "🙏": ["u"] });
    expect(setMessageReactions(data, "other", (r) => r)).toBe(data);
  });
});

describe("GIFs", () => {
  it("accepts https links to the GIF hosts only", () => {
    expect(isAllowedGifUrl("https://static.klipy.com/ii/abc/x.gif")).toBe(true);
    expect(isAllowedGifUrl("https://media.klipy.co/x.gif")).toBe(true);
    expect(isAllowedGifUrl("http://static.klipy.com/x.gif")).toBe(false);
    expect(isAllowedGifUrl("https://klipy.com.evil.test/x.gif")).toBe(false);
    expect(isAllowedGifUrl("javascript:alert(1)")).toBe(false);
  });

  it("reads a Tenor-v2-shaped answer and skips results without a usable file", () => {
    const page = parseGifResponse({
      next: "24",
      results: [
        {
          id: 7,
          title: "Kot",
          media_formats: {
            mediumgif: { url: "https://static.klipy.com/m.gif", dims: [300, 200] },
            tinygif: { url: "https://static.klipy.com/t.gif", dims: [150, 100] },
            tinymp4: { url: "https://static.klipy.com/t.mp4", dims: [300, 200] },
          },
        },
        {
          id: 9,
          media_formats: {
            gif: { url: "https://static.klipy.com/g.gif", dims: [200, 200] },
            mp4: { url: "https://evil.test/v.mp4", dims: [200, 200] },
          },
        },
        { id: 8, media_formats: { gif: { url: "https://evil.test/x.gif", dims: [1, 1] } } },
      ],
    });
    expect(page.next).toBe("24");
    expect(page.results).toEqual([
      {
        id: "7",
        title: "Kot",
        url: "https://static.klipy.com/m.gif",
        preview_url: "https://static.klipy.com/t.gif",
        mp4_url: "https://static.klipy.com/t.mp4",
        width: 300,
        height: 200,
      },
      {
        id: "9",
        title: "",
        url: "https://static.klipy.com/g.gif",
        preview_url: "https://static.klipy.com/g.gif",
        mp4_url: null,
        width: 200,
        height: 200,
      },
    ]);
    expect(gifToMedia(page.results[0])).toMatchObject({
      kind: "gif",
      provider: "klipy",
      mp4_url: "https://static.klipy.com/t.mp4",
    });
    expect(gifToMedia(page.results[1])).not.toHaveProperty("mp4_url");
    expect(parseGifResponse({ results: [], next: "" }).next).toBeNull();
  });

  it("fits a GIF in the message box keeping its ratio", () => {
    expect(fitGif({ width: 480, height: 270 })).toEqual({ width: 240, height: 135 });
    expect(fitGif({ width: 100, height: 400 })).toEqual({ width: 50, height: 200 });
    expect(fitGif({ width: 120, height: 80 })).toEqual({ width: 120, height: 80 });
  });
});

describe("isEmojiOnly", () => {
  it("is true for up to three emoji", () => {
    expect(isEmojiOnly("👍")).toBe(true);
    expect(isEmojiOnly("❤️ 😂")).toBe(true);
    expect(isEmojiOnly("👨‍👩‍👧")).toBe(true);
  });

  it("is false for text, numbers and longer runs", () => {
    expect(isEmojiOnly("ok 👍")).toBe(false);
    expect(isEmojiOnly("12")).toBe(false);
    expect(isEmojiOnly("😂😂😂😂")).toBe(false);
    expect(isEmojiOnly("")).toBe(false);
  });
});
