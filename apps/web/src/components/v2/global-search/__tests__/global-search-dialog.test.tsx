import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchEntry } from "@/lib/global-search/types";
import { GlobalSearchDialog } from "../global-search-dialog";
import { useGlobalSearchStore } from "../global-search-store";

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
const setTheme = vi.fn();
const changeBranchMock = vi.fn();
const findExactHitsMock = vi.fn();
const previewMock = vi.fn();
const setColorThemeMock = vi.fn();

vi.mock("next-intl", () => ({
  useLocale: () => "pl",
  useTranslations: (namespace?: string) =>
    Object.assign(
      (key: string, values?: Record<string, string>) =>
        values?.name ? `${key}:${values.name}` : key,
      {
        // Root lookups fall back to entry.title; palette group headings resolve
        has: (key: string) => namespace === "globalSearch" && key.startsWith("groups."),
      }
    ),
}));

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme }) }));
vi.mock("next/navigation", () => ({ useParams: () => ({}) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
  usePathname: () => "/dashboard/start",
  getPathname: ({ href }: { href: string }) => `/pl-path${href}`,
}));
vi.mock("@/lib/stores/v2/app-store", () => ({
  useAppStoreV2: () => ({
    accessibleBranches: [
      { id: "b1", name: "CNP Poznań" },
      { id: "b2", name: "CNP Piaseczno" },
    ],
    activeBranchId: "b1",
    activeOrgId: "o1",
    setActiveBranch: vi.fn(),
  }),
}));
vi.mock("@/lib/stores/v2/user-store", () => ({
  useUserStoreV2: (selector: (s: { user: { id: string } }) => unknown) =>
    selector({ user: { id: "u1" } }),
}));
vi.mock("@/lib/stores/v2/ui-store", () => ({
  useUiStoreV2: (
    selector: (s: { setTheme: () => void; setColorTheme: (n: string) => void }) => unknown
  ) => selector({ setTheme: vi.fn(), setColorTheme: setColorThemeMock }),
}));
vi.mock("@/app/actions/shared/changeBranch", () => ({
  changeBranch: (id: string) => changeBranchMock(id),
}));
vi.mock("@/app/[locale]/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/actions/global-search", () => ({
  globalSearchAction: (...args: unknown[]) => findExactHitsMock(...args),
  getSearchPreviewAction: (...args: unknown[]) => previewMock(...args),
}));
vi.mock("@/hooks/use-debounce", () => ({ useDebounce: <T,>(value: T) => value }));
vi.mock("../global-search-scanner", () => ({
  GlobalSearchScanner: ({ onDetected }: { onDetected: (code: unknown) => void }) => (
    <div>
      <button type="button" onClick={() => onDetected({ kind: "text", text: "2K5807221KGRU" })}>
        fake-scan-text
      </button>
      <button type="button" onClick={() => onDetected({ kind: "ambraQr", token: "tok1" })}>
        fake-scan-qr
      </button>
    </div>
  ),
}));

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GlobalSearchDialog entries={entries} sources={["repairOrders", "items", "tickets"]} />
    </QueryClientProvider>
  );
}

const entries: SearchEntry[] = [
  {
    id: "workshop",
    kind: "page",
    section: "workshop",
    title: "Zlecenia",
    iconKey: "car",
    href: "/dashboard/workshop",
    keywords: ["zl"],
  },
  {
    id: "warehouse.inventory",
    kind: "page",
    section: "warehouse",
    title: "Stany",
    iconKey: "clipboard",
    href: "/dashboard/warehouse/inventory",
  },
  {
    id: "search.action.newRepairOrder",
    kind: "action",
    section: "workshop",
    title: "Nowe zlecenie",
    iconKey: "car",
    href: "/dashboard/workshop/new",
  },
  {
    id: "search.action.pickColorTheme",
    kind: "action",
    section: "general",
    title: "Zmień motyw kolorystyczny",
    iconKey: "preferences",
    command: "colorTheme.pick",
    keywords: ["motyw", "kolory"],
  },
  {
    id: "search.action.toggleTheme",
    kind: "action",
    section: "general",
    title: "Przełącz motyw",
    iconKey: "preferences",
    command: "theme.toggle",
  },
];

/** Matches the deepest element whose whole text is `value` (labels are split by <mark>) */
const byText =
  (value: string) =>
  (_content: string, element: Element | null): boolean =>
    !!element &&
    element.textContent === value &&
    ![...element.children].some((child) => child.textContent === value);

function openPalette() {
  act(() => {
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
  });
}

function type(text: string) {
  fireEvent.change(screen.getByRole("combobox"), { target: { value: text } });
}

describe("GlobalSearchDialog", () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    Element.prototype.scrollIntoView ??= vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    findExactHitsMock.mockResolvedValue({
      success: true,
      data: { exact: [], results: [], otherBranches: [] },
    });
    previewMock.mockResolvedValue({ success: true, data: null });
    useGlobalSearchStore.setState({ open: false, initialQuery: "" });
    window.localStorage.clear();
  });

  it("does not search data for one character or in > mode", () => {
    renderDialog();
    openPalette();
    type("z");
    type("> nowe");
    expect(findExactHitsMock).not.toHaveBeenCalled();
  });

  it("shows an exact hit for a pasted number and opens it on Enter", async () => {
    findExactHitsMock.mockResolvedValue({
      success: true,
      data: {
        exact: [
          {
            type: "ticket",
            id: "t1",
            code: "HD-000012",
            title: "Brak podpórki",
            subtitle: null,
            status: "open",
            href: "/dashboard/help-desk/tickets/t1",
          },
        ],
        results: [],
        otherBranches: [],
      },
    });
    renderDialog();
    openPalette();
    type("HD-12");

    expect(
      await within(screen.getByRole("listbox")).findByText(byText("HD-000012"))
    ).toBeInTheDocument();
    expect(screen.getByText("groups.exact")).toBeInTheDocument();
    expect(findExactHitsMock).toHaveBeenCalledWith("HD-12", undefined);

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/dashboard/help-desk/tickets/t1");
  });

  it("groups data results by type below pages, with stock and matched part details", async () => {
    findExactHitsMock.mockResolvedValue({
      success: true,
      data: {
        exact: [],
        results: [
          {
            type: "item",
            id: "p1",
            code: "2K5807221KGRU",
            title: "Poszycie zderzaka",
            subtitle: null,
            status: null,
            href: "/dashboard/warehouse/items/p1",
            meta: { onHand: 2, available: 1 },
          },
          {
            type: "repairOrder",
            id: "ro1",
            code: "174232",
            title: "Lakomecki",
            subtitle: null,
            status: "open",
            href: "/dashboard/workshop/ro1",
            meta: { warehouseCode: "3122", matchedPart: "2K5807221KGRU" },
          },
        ],
        otherBranches: [],
      },
    });
    renderDialog();
    openPalette();
    type("2K5807");

    expect(await screen.findByText("dataGroups.repairOrder")).toBeInTheDocument();
    expect(screen.getByText("dataGroups.item")).toBeInTheDocument();
    expect(screen.getByText("details.stock")).toBeInTheDocument();
    expect(
      within(screen.getByRole("listbox")).getByText("details.warehouse · details.containsPart")
    ).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("listbox")).getByText(byText("2K5807221KGRU")));
    expect(push).toHaveBeenCalledWith("/dashboard/warehouse/items/p1");
  });

  it("toggles with Ctrl+K and shows quick actions and pages when empty", () => {
    renderDialog();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    openPalette();
    expect(screen.getByText("groups.quickActions")).toBeInTheDocument();
    expect(screen.getByText("groups.goTo")).toBeInTheDocument();
    expect(screen.getByText(byText("Nowe zlecenie"))).toBeInTheDocument();

    openPalette();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("filters by text and navigates on Enter", () => {
    renderDialog();
    openPalette();
    type("stany");

    expect(screen.getByText(byText("Stany"))).toBeInTheDocument();
    expect(screen.queryByText(byText("Zlecenia"))).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/dashboard/warehouse/inventory");
    expect(useGlobalSearchStore.getState().open).toBe(false);
  });

  it("shows only actions in > mode, including branch switching", () => {
    renderDialog();
    openPalette();
    type(">");

    expect(screen.getByRole("tab", { name: "scopeActions" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.queryByText(byText("Zlecenia"))).not.toBeInTheDocument();
    expect(screen.getByText(byText("Nowe zlecenie"))).toBeInTheDocument();
    expect(screen.getByText(byText("switchBranch:CNP Piaseczno"))).toBeInTheDocument();
    // The active branch is not offered
    expect(screen.queryByText("switchBranch:CNP Poznań")).not.toBeInTheDocument();
  });

  it("switches the branch through the server action", async () => {
    changeBranchMock.mockResolvedValue({ success: true });
    renderDialog();
    openPalette();
    type("> piaseczno");

    await act(async () => {
      fireEvent.click(screen.getByText(byText("switchBranch:CNP Piaseczno")));
    });
    expect(changeBranchMock).toHaveBeenCalledWith("b2");
    expect(replace).toHaveBeenCalledWith("/dashboard/start");
    expect(refresh).toHaveBeenCalled();
  });

  it("runs client commands", () => {
    renderDialog();
    openPalette();
    type("motyw");
    fireEvent.click(screen.getByText(byText("Przełącz motyw")));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("opens a page in a new tab with Ctrl+Enter", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderDialog();
    openPalette();
    type("zl");

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter", ctrlKey: true });
    expect(open).toHaveBeenCalledWith("/pl-path/dashboard/workshop", "_blank", "noopener");
    expect(push).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("limits the search to one source with a scope chip or prefix", async () => {
    renderDialog();
    openPalette();
    type("2K5807");
    fireEvent.click(screen.getByRole("tab", { name: "scopes.items" }));

    expect(screen.getByRole("combobox")).toHaveValue("cz: 2K5807");
    expect(screen.getByRole("tab", { name: "scopes.items" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    // Pages and actions are hidden in a scope
    expect(screen.queryByText(byText("Zlecenia"))).not.toBeInTheDocument();

    await waitFor(() => expect(findExactHitsMock).toHaveBeenLastCalledWith("2K5807", "items"));
  });

  it("shows only chips of searchable sources", () => {
    renderDialog();
    openPalette();
    expect(screen.getByRole("tab", { name: "scopes.repairOrders" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "scopes.people" })).not.toBeInTheDocument();
  });

  it("remembers opened pages and lists them when the query is empty", () => {
    renderDialog();
    openPalette();
    type("stany");
    fireEvent.click(screen.getByText(byText("Stany")));
    expect(push).toHaveBeenCalledWith("/dashboard/warehouse/inventory");

    openPalette();
    expect(screen.getByText("groups.recent")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText(byText("Stany"))[0]!);
    expect(push).toHaveBeenLastCalledWith("/dashboard/warehouse/inventory");
  });

  it("highlights the matched part of a label", () => {
    renderDialog();
    openPalette();
    type("zlec");
    const mark = screen.getAllByText("Zlec").find((el) => el.tagName === "MARK");
    expect(mark).toBeDefined();
  });

  const orderHit = (n: number) => ({
    type: "repairOrder",
    id: `ro${n}`,
    code: `17423${n}`,
    title: `Klient ${n}`,
    subtitle: null,
    status: "open",
    href: `/dashboard/workshop/ro${n}`,
    meta: {},
  });

  it("adds a show-all row to a full group that opens the module list with the query", async () => {
    findExactHitsMock.mockResolvedValue({
      success: true,
      data: { exact: [], results: [1, 2, 3, 4, 5].map(orderHit), otherBranches: [] },
    });
    renderDialog();
    openPalette();
    type("17423");

    fireEvent.click(await screen.findByText("showAll"));
    expect(push).toHaveBeenCalledWith({ pathname: "/dashboard/workshop", query: { q: "17423" } });
  });

  it("lists matches in other branches and switches branch on click", async () => {
    changeBranchMock.mockResolvedValue({ success: true });
    findExactHitsMock.mockResolvedValue({
      success: true,
      data: {
        exact: [],
        results: [orderHit(1)],
        otherBranches: [
          { branchId: "b2", count: 3 },
          { branchId: "unknown", count: 1 },
        ],
      },
    });
    renderDialog();
    openPalette();
    type("17423");

    expect(await screen.findByText("otherBranches")).toBeInTheDocument();
    // Only branches the user can access are offered
    expect(screen.getAllByText(/^otherBranchCount/)).toHaveLength(1);
    await act(async () => {
      fireEvent.click(screen.getByText("otherBranchCount:CNP Piaseczno"));
    });
    expect(changeBranchMock).toHaveBeenCalledWith("b2");
  });

  it("opens a repair order straight on one of its warehouse tabs from the preview", async () => {
    findExactHitsMock.mockResolvedValue({
      success: true,
      data: {
        exact: [
          {
            type: "repairOrder",
            id: "ro1",
            code: "ZL/174232",
            title: "Lakomecki",
            subtitle: null,
            status: "open",
            href: "/dashboard/workshop/ro1",
          },
        ],
        results: [],
        otherBranches: [],
      },
    });
    renderDialog();
    openPalette();
    type("174232");

    fireEvent.click(await screen.findByRole("button", { name: "preview.tabStock" }));
    expect(push).toHaveBeenCalledWith("/dashboard/workshop/ro1?tab=stock#warehouse");
    expect(useGlobalSearchStore.getState().open).toBe(false);
  });

  it("previews the highlighted part with stock and offers copy and → into the actions", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    findExactHitsMock.mockResolvedValue({
      success: true,
      data: {
        exact: [
          {
            type: "item",
            id: "p1",
            code: "2K5807221KGRU",
            title: "Poszycie zderzaka",
            subtitle: null,
            status: null,
            href: "/dashboard/warehouse/items/p1",
          },
        ],
        results: [],
        otherBranches: [],
      },
    });
    previewMock.mockResolvedValue({
      success: true,
      data: {
        type: "item",
        name: "Poszycie zderzaka",
        brand: null,
        skus: ["2K5807221KGRU"],
        onHand: 2,
        committed: 1,
        available: 1,
        locations: [{ code: "MC/GAB-01", name: "Zderzaki", onHand: 2 }],
        orders: [
          { id: "ro9", code: "174232", client: "Lakomecki", warehouseCode: "3122", quantity: 1 },
        ],
      },
    });
    renderDialog();
    openPalette();
    type("2K5807221KGRU");

    expect(await screen.findByText(byText("MC/GAB-01"))).toBeInTheDocument();
    expect(previewMock).toHaveBeenCalledWith("item", "p1");

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "c", ctrlKey: true, shiftKey: true });
    expect(writeText).toHaveBeenCalledWith("2K5807221KGRU");

    // Order rows in the preview open the order
    fireEvent.click(screen.getByText(byText("174232")));
    expect(push).toHaveBeenCalledWith("/dashboard/workshop/ro9");
  });

  it("searches a scanned barcode and opens an Ambra QR label on its QR page", async () => {
    renderDialog();
    openPalette();
    fireEvent.click(screen.getByRole("button", { name: "scanner.open" }));
    fireEvent.click(screen.getByText("fake-scan-text"));
    expect(screen.getByRole("combobox")).toHaveValue("2K5807221KGRU");
    await waitFor(() =>
      expect(findExactHitsMock).toHaveBeenLastCalledWith("2K5807221KGRU", undefined)
    );

    fireEvent.click(screen.getByRole("button", { name: "scanner.open" }));
    fireEvent.click(screen.getByText("fake-scan-qr"));
    expect(push).toHaveBeenCalledWith("/qr/tok1");
    expect(useGlobalSearchStore.getState().open).toBe(false);
  });

  it("previews colour themes while browsing, restores on Esc and saves on Enter", () => {
    document.documentElement.setAttribute("data-theme", "default");
    renderDialog();
    openPalette();
    type("kolory");
    fireEvent.click(screen.getByText(byText("Zmień motyw kolorystyczny")));

    expect(screen.getByText("colorTheme.heading")).toBeInTheDocument();
    const input = screen.getByRole("combobox");
    // Arrow down highlights the next theme and previews it, nothing saved yet
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("sunset");
    expect(setColorThemeMock).not.toHaveBeenCalled();

    // Esc restores the theme the picker opened with and goes back to the search
    fireEvent.keyDown(input, { key: "Escape" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("default");
    expect(screen.queryByText("colorTheme.heading")).not.toBeInTheDocument();
    expect(useGlobalSearchStore.getState().open).toBe(true);

    // Pick again, filter, Enter saves
    type("kolory");
    fireEvent.click(screen.getByText(byText("Zmień motyw kolorystyczny")));
    type("graph");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(setColorThemeMock).toHaveBeenCalledWith("graphite");
    expect(document.documentElement.getAttribute("data-theme")).toBe("graphite");
    expect(useGlobalSearchStore.getState().open).toBe(false);
  });

  it("undoes an unsaved theme preview when the palette closes", () => {
    document.documentElement.setAttribute("data-theme", "default");
    renderDialog();
    openPalette();
    type("kolory");
    fireEvent.click(screen.getByText(byText("Zmień motyw kolorystyczny")));
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("sunset");

    openPalette(); // Ctrl+K closes
    expect(document.documentElement.getAttribute("data-theme")).toBe("default");
    expect(setColorThemeMock).not.toHaveBeenCalled();
  });

  it("cycles the search scope with Tab and Shift+Tab and paints the prefix", async () => {
    renderDialog();
    openPalette();
    type("2K5807");
    const input = screen.getByRole("combobox");

    fireEvent.keyDown(input, { key: "Tab" });
    expect(input).toHaveValue("zl: 2K5807");
    expect(screen.getByRole("tab", { name: "scopes.repairOrders" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await waitFor(() =>
      expect(findExactHitsMock).toHaveBeenLastCalledWith("2K5807", "repairOrders")
    );

    fireEvent.keyDown(input, { key: "Tab" });
    expect(input).toHaveValue("cz: 2K5807");
    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    expect(input).toHaveValue("zl: 2K5807");

    // The typed prefix is painted in the accent colour, no badge beside the input
    expect(screen.getByText("zl:").className).toContain("text-primary");
    expect(screen.queryByText("actionsModeBadge")).not.toBeInTheDocument();

    // Shift+Tab from "all" wraps to the actions mode
    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    expect(input).toHaveValue("> 2K5807");
  });

  it("keeps the focus in the input on Shift+Tab (never jumps to the scanner)", () => {
    renderDialog();
    openPalette();
    const input = screen.getByRole("combobox");
    input.focus();

    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    expect(input).toHaveValue("> ");
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("button", { name: "scanner.open" })).not.toHaveFocus();
  });

  it("goes back to all results on Esc in a scope, then closes on the next Esc", () => {
    renderDialog();
    openPalette();
    type("cz: 2K5807");
    const input = screen.getByRole("combobox");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("2K5807");
    expect(screen.getByRole("tab", { name: "scopeAll" })).toHaveAttribute("aria-selected", "true");
    expect(useGlobalSearchStore.getState().open).toBe(true);

    fireEvent.keyDown(input, { key: "Escape" });
    expect(useGlobalSearchStore.getState().open).toBe(false);
  });

  it("numbers the first results and opens one with Alt+digit", () => {
    renderDialog();
    openPalette();
    type("zlec");

    const keys = screen.getAllByTestId("quick-key");
    expect(keys.map((key) => key.textContent)).toEqual(keys.map((_, i) => `Alt ${i + 1}`));
    const second = keys[1]?.closest("[cmdk-item]")?.textContent ?? "";
    const href = second.includes("Nowe zlecenie")
      ? "/dashboard/workshop/new"
      : "/dashboard/workshop";

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "2", code: "Digit2", altKey: true });
    expect(push).toHaveBeenCalledWith(href);
    expect(useGlobalSearchStore.getState().open).toBe(false);
  });
});
