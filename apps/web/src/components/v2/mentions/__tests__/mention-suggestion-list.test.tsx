import { createRef } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MentionSuggestionListHandle } from "@repo/rich-text/mention";
import { SearchSourcesProvider } from "@/lib/global-search/sources-context";
import type { SearchSourceId } from "@/lib/global-search/sources";
import { MentionScopeProvider } from "../mention-scope";
import { MentionSuggestionList } from "../mention-suggestion-list";

const searchMock = vi.fn();
const peopleMock = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => false;
    return t;
  },
}));
vi.mock("@/app/actions/global-search", () => ({
  globalSearchAction: (query: string, scope?: string) => searchMock(query, scope),
}));
vi.mock("@/app/actions/mentions", () => ({
  listMentionPeopleAction: () => peopleMock(),
  resolveMentionsAction: vi.fn(),
}));
vi.mock("@/lib/stores/v2/app-store", () => ({
  useAppStoreV2: (selector: (state: unknown) => unknown) =>
    selector({ activeOrgId: "o1", activeBranchId: "b1" }),
}));
vi.mock("@/hooks/use-debounce", () => ({ useDebounce: <T,>(value: T) => value }));

const PEOPLE = [
  {
    userId: "u1",
    firstName: "Anna",
    lastName: "Nowak",
    email: "anna@x.test",
    avatarUrl: null,
    jobTitle: null,
  },
  {
    userId: "u2",
    firstName: "Zofia",
    lastName: "Kowalska",
    email: "zofia@x.test",
    avatarUrl: null,
    jobTitle: "Doradca",
  },
];
const ORDER = {
  type: "repairOrder",
  id: "r1",
  code: "174232",
  title: "Golf VII",
  subtitle: null,
  status: null,
  href: "/dashboard/workshop/r1",
};
const COMMENT = { ...ORDER, type: "comment", id: "c1", code: null, title: "komentarz 174232" };

function setup(
  query: string,
  { sources = ["repairOrders", "items"] as SearchSourceId[], priority = [] as string[] } = {}
) {
  const ref = createRef<MentionSuggestionListHandle>();
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (value: string) => (
    <QueryClientProvider client={client}>
      <SearchSourcesProvider sources={sources}>
        <MentionScopeProvider value={{ priorityUserIds: new Set(priority) }}>
          <MentionSuggestionList ref={ref} query={value} onSelect={onSelect} onClose={onClose} />
        </MentionScopeProvider>
      </SearchSourcesProvider>
    </QueryClientProvider>
  );
  const view = render(tree(query));
  const key = (name: string, shiftKey = false) => {
    let handled = false;
    act(() => {
      handled = ref.current!.onKeyDown(new KeyboardEvent("keydown", { key: name, shiftKey }));
    });
    return handled;
  };
  return { onSelect, onClose, key, rerender: (value: string) => view.rerender(tree(value)) };
}

/** Rows by their text (a highlighted match splits the accessible name) */
async function findOption(text: string) {
  return waitFor(() => {
    const option = screen.queryAllByRole("option").find((item) => item.textContent?.includes(text));
    if (!option) throw new Error(`no option with "${text}"`);
    return option;
  });
}

describe("MentionSuggestionList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    peopleMock.mockResolvedValue({ success: true, data: PEOPLE });
    searchMock.mockResolvedValue({
      success: true,
      data: { exact: [ORDER], results: [COMMENT], otherBranches: [] },
    });
  });

  it("empty query: people, those of the conversation first; no data search", async () => {
    setup("", { priority: ["u2"] });
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "ZKZofia KowalskaDoradcainConversation",
      "ANAnna Nowakanna@x.test",
    ]);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("people match from the first letter; Enter inserts the highlighted person", async () => {
    const { key, onSelect } = setup("an");
    await findOption("Anna Nowak");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(key("Enter")).toBe(true);
    expect(onSelect).toHaveBeenCalledWith({ type: "person", id: "u1", label: "Anna Nowak" });
  });

  it("three characters search the Ctrl+K engine; only mentionable types are listed", async () => {
    const { key, onSelect } = setup("1742");
    await findOption("174232");
    expect(searchMock).toHaveBeenCalledWith("1742", undefined);
    expect(screen.getAllByRole("option")).toHaveLength(1);
    key("Enter");
    expect(onSelect).toHaveBeenCalledWith({
      type: "repairOrder",
      id: "r1",
      label: "Golf VII",
      code: "174232",
      href: "/dashboard/workshop/r1",
    });
    // Remembered for the next empty "@"
    expect(window.localStorage.getItem("ambra:mentions:recent:o1")).toContain("174232");
  });

  it("a scope prefix narrows the search like in the palette", async () => {
    setup("zl:1742");
    await findOption("174232");
    expect(searchMock).toHaveBeenCalledWith("1742", "repairOrders");
    expect(screen.getByRole("tab", { name: "scopes.repairOrders" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("Tab and Shift+Tab move through the scopes the user may search", async () => {
    const { key } = setup("");
    await screen.findAllByRole("option");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "all",
      "people",
      "scopes.repairOrders",
      "scopes.items",
    ]);
    expect(key("Tab")).toBe(true);
    expect(screen.getByRole("tab", { name: "people" })).toHaveAttribute("aria-selected", "true");
    key("Tab", true);
    key("Tab", true);
    expect(screen.getByRole("tab", { name: "scopes.items" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    // A data scope lists no people
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("arrows move the highlight and wrap around", async () => {
    const { key, onSelect } = setup("");
    await screen.findAllByRole("option");
    key("ArrowUp");
    key("Enter");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "u2" }));
  });

  it("without sources only people can be mentioned", async () => {
    setup("1742", { sources: [] });
    await waitFor(() => expect(peopleMock).toHaveBeenCalled());
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("Enter with nothing to insert closes the list and is not swallowed", async () => {
    const { key, onClose, onSelect } = setup("qq", { sources: [] });
    await waitFor(() => expect(screen.getByText("empty")).toBeInTheDocument());
    expect(key("Enter")).toBe(false);
    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("prose after the @ (a space, nothing matching) closes the list", async () => {
    const { onClose } = setup("home we go", { sources: [] });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
