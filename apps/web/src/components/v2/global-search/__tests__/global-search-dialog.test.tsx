import { act, fireEvent, render, screen } from "@testing-library/react";
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
    setActiveBranch: vi.fn(),
  }),
}));
vi.mock("@/lib/stores/v2/ui-store", () => ({
  useUiStoreV2: (selector: (s: { setTheme: () => void }) => unknown) =>
    selector({ setTheme: vi.fn() }),
}));
vi.mock("@/app/actions/shared/changeBranch", () => ({
  changeBranch: (id: string) => changeBranchMock(id),
}));
vi.mock("@/app/[locale]/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/actions/global-search", () => ({
  findSearchExactHitsAction: (query: string) => findExactHitsMock(query),
}));
vi.mock("@/hooks/use-debounce", () => ({ useDebounce: <T,>(value: T) => value }));

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GlobalSearchDialog entries={entries} />
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
    id: "search.action.toggleTheme",
    kind: "action",
    section: "general",
    title: "Przełącz motyw",
    iconKey: "preferences",
    command: "theme.toggle",
  },
];

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
    findExactHitsMock.mockResolvedValue({ success: true, data: [] });
    useGlobalSearchStore.setState({ open: false, initialQuery: "" });
  });

  it("does not query the database for plain words", () => {
    renderDialog();
    openPalette();
    type("stany");
    expect(findExactHitsMock).not.toHaveBeenCalled();
  });

  it("shows an exact hit for a pasted number and opens it on Enter", async () => {
    findExactHitsMock.mockResolvedValue({
      success: true,
      data: [
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
    });
    renderDialog();
    openPalette();
    type("HD-12");

    expect(await screen.findByText("HD-000012")).toBeInTheDocument();
    expect(screen.getByText("groups.exact")).toBeInTheDocument();
    expect(findExactHitsMock).toHaveBeenCalledWith("HD-12");

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/dashboard/help-desk/tickets/t1");
  });

  it("toggles with Ctrl+K and shows quick actions and pages when empty", () => {
    renderDialog();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    openPalette();
    expect(screen.getByText("groups.quickActions")).toBeInTheDocument();
    expect(screen.getByText("groups.goTo")).toBeInTheDocument();
    expect(screen.getByText("Nowe zlecenie")).toBeInTheDocument();

    openPalette();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("filters by text and navigates on Enter", () => {
    renderDialog();
    openPalette();
    type("stany");

    expect(screen.getByText("Stany")).toBeInTheDocument();
    expect(screen.queryByText("Zlecenia")).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/dashboard/warehouse/inventory");
    expect(useGlobalSearchStore.getState().open).toBe(false);
  });

  it("shows only actions in > mode, including branch switching", () => {
    renderDialog();
    openPalette();
    type(">");

    expect(screen.getByText("actionsModeBadge")).toBeInTheDocument();
    expect(screen.queryByText("Zlecenia")).not.toBeInTheDocument();
    expect(screen.getByText("Nowe zlecenie")).toBeInTheDocument();
    expect(screen.getByText("switchBranch:CNP Piaseczno")).toBeInTheDocument();
    // The active branch is not offered
    expect(screen.queryByText("switchBranch:CNP Poznań")).not.toBeInTheDocument();
  });

  it("switches the branch through the server action", async () => {
    changeBranchMock.mockResolvedValue({ success: true });
    renderDialog();
    openPalette();
    type("> piaseczno");

    await act(async () => {
      fireEvent.click(screen.getByText("switchBranch:CNP Piaseczno"));
    });
    expect(changeBranchMock).toHaveBeenCalledWith("b2");
    expect(replace).toHaveBeenCalledWith("/dashboard/start");
    expect(refresh).toHaveBeenCalled();
  });

  it("runs client commands", () => {
    renderDialog();
    openPalette();
    type("motyw");
    fireEvent.click(screen.getByText("Przełącz motyw"));
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
});
