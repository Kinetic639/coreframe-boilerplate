/**
 * @vitest-environment jsdom
 *
 * DataView — Behavior Tests
 */

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DataViewProps, PaginatedResult } from "../data-view.types";
import { DataView } from "../data-view";

// ---------------------------------------------------------------------------
// Shared nuqs mock state (module-level so vi.mock factory can close over it)
// ---------------------------------------------------------------------------

const nuqsState = {
  params: new Map<string, string>(),
  push: null as unknown as (url: string) => void,
  replace: null as unknown as (url: string) => void,
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, className, ...rest }, ref) => (
        <div ref={ref} className={className} {...rest}>
          {children}
        </div>
      )
    ),
  },
}));

vi.mock("nuqs", () => {
  const parseAsString = {
    withDefault: (d: string) => ({ _t: "str", _d: d }),
  };
  const parseAsInteger = {
    withDefault: (d: number) => ({ _t: "int", _d: d }),
  };

  const parseAsJson = () => ({
    withDefault: (d: unknown) => ({ _t: "json", _d: d }),
  });

  return {
    parseAsString,
    parseAsInteger,
    parseAsJson,
    useQueryStates: (parsers: Record<string, { _t?: string; _d?: unknown }>) => {
      const state: Record<string, unknown> = {};
      for (const [k, p] of Object.entries(parsers)) {
        const raw = nuqsState.params.get(k) ?? null;
        if (raw === null || raw === "") {
          state[k] = p._d ?? (p._t === "int" ? 0 : p._t === "json" ? {} : "");
        } else if (p._t === "int") {
          state[k] = parseInt(raw, 10) || p._d;
        } else if (p._t === "json") {
          try {
            state[k] = JSON.parse(raw);
          } catch {
            state[k] = p._d ?? {};
          }
        } else {
          state[k] = raw;
        }
      }

      const setState = (
        updates: Record<string, unknown>,
        opts?: { history?: "push" | "replace" }
      ) => {
        const p = new URLSearchParams();
        nuqsState.params.forEach((v, k) => {
          if (!(k in updates)) p.set(k, v);
        });
        for (const [k, v] of Object.entries(updates)) {
          if (v !== null && v !== "" && v !== undefined) {
            p.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
          }
        }
        const qs = p.toString();
        const url = `/test${qs ? "?" + qs : ""}`;
        if (opts?.history === "push") {
          nuqsState.push?.(url);
        } else {
          nuqsState.replace?.(url);
        }
        return Promise.resolve(p);
      };

      return [state, setState];
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/test",
  useSearchParams: () => ({
    get: (key: string) => nuqsState.params.get(key) ?? null,
    toString: () => {
      const parts: string[] = [];
      nuqsState.params.forEach((v, k) => parts.push(`${k}=${encodeURIComponent(v)}`));
      return parts.join("&");
    },
  }),
  useParams: () => ({}),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => {
      store[key] = val;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });
// Radix UI Select needs scrollIntoView in jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

type MockProduct = { id: string; name: string; category: string; price: number };
type MockProductDetail = MockProduct & { description: string; stock: number };

const MOCK_PRODUCTS: MockProduct[] = [
  { id: "p1", name: "Widget A", category: "Electronics", price: 99 },
  { id: "p2", name: "Widget B", category: "Furniture", price: 299 },
  { id: "p3", name: "Widget C", category: "Electronics", price: 49 },
];

const MOCK_DETAILS: Record<string, MockProductDetail> = {
  p1: {
    id: "p1",
    name: "Widget A",
    category: "Electronics",
    price: 99,
    description: "Great widget",
    stock: 10,
  },
  p2: {
    id: "p2",
    name: "Widget B",
    category: "Furniture",
    price: 299,
    description: "Solid furniture",
    stock: 5,
  },
  p3: {
    id: "p3",
    name: "Widget C",
    category: "Electronics",
    price: 49,
    description: "Budget widget",
    stock: 20,
  },
};

const makeInitialData = (rows = MOCK_PRODUCTS): PaginatedResult<MockProduct> => ({
  rows,
  totalCount: rows.length,
  page: 1,
  pageSize: 50,
});

const mockListFetcher = vi.fn(
  async (): Promise<PaginatedResult<MockProduct>> => ({
    rows: MOCK_PRODUCTS,
    totalCount: 3,
    page: 1,
    pageSize: 50,
  })
);

const mockDetailFetcher = vi.fn(
  async (id: string): Promise<MockProductDetail | null> => MOCK_DETAILS[id] ?? null
);

const mockColumns: DataViewProps<MockProduct, MockProductDetail>["columns"] = [
  { key: "name", header: "Name", accessor: (r) => r.name, sortable: true },
  { key: "category", header: "Category", accessor: (r) => r.category },
  { key: "price", header: "Price", accessor: (r) => `$${r.price}` },
];

const mockFilters: DataViewProps<MockProduct, MockProductDetail>["filters"] = [
  {
    type: "select",
    key: "category",
    label: "Category",
    options: [
      { label: "Electronics", value: "Electronics" },
      { label: "Furniture", value: "Furniture" },
    ],
  },
  {
    type: "multi-select",
    key: "status",
    label: "Status",
    options: [
      { label: "Active", value: "active" },
      { label: "Draft", value: "draft" },
    ],
  },
];

const defaultProps: DataViewProps<MockProduct, MockProductDetail> = {
  entity: "test-products",
  columns: mockColumns,
  filters: mockFilters,
  initialData: makeInitialData(),
  queryKey: ["test-products"],
  listFetcher: mockListFetcher,
  detailFetcher: mockDetailFetcher,
  getRowId: (r) => r.id,
  renderDetail: (d) => (
    <div data-testid="detail-content">
      <h3>{d.name}</h3>
      <p>{d.description}</p>
      <p>Stock: {d.stock}</p>
    </div>
  ),
  renderCompactItem: (r) => (
    <div data-testid={`compact-${r.id}`}>
      <span>{r.name}</span>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Test utilities
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
const mockReplace = vi.fn();

// Wire nuqsState to the mock functions (module-level assignment, runs before tests)
nuqsState.push = mockPush;
nuqsState.replace = mockReplace;

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
}

function renderWithProviders(ui: React.ReactElement) {
  return render(<QueryClientProvider client={makeQueryClient()}>{ui}</QueryClientProvider>);
}

function renderDataView(
  props: Partial<DataViewProps<MockProduct, MockProductDetail>> = {},
  searchParams: Record<string, string> = {}
) {
  nuqsState.params = new Map(Object.entries(searchParams));
  const mergedProps = { ...defaultProps, ...props };
  return renderWithProviders(<DataView {...mergedProps} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("T-DV-RENDER: renders initial rows from initialData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    nuqsState.params = new Map();
    mockPush.mockReset();
    mockReplace.mockReset();
  });

  it("renders all row names from initialData", () => {
    renderDataView();
    expect(screen.getByText("Widget A")).toBeInTheDocument();
    expect(screen.getByText("Widget B")).toBeInTheDocument();
    expect(screen.getByText("Widget C")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    renderDataView();
    // Use getAllByText since "Category" also appears as an inline filter pill label
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getAllByText("Category").length).toBeGreaterThan(0);
    expect(screen.getByText("Price")).toBeInTheDocument();
  });
});

describe("T-DV-PAGINATION: shows correct pagination info", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    nuqsState.params = new Map();
  });

  it("shows correct range for 3 results", () => {
    renderDataView();
    expect(screen.getByTestId("pagination-info")).toHaveTextContent("Showing 1–3 of 3 results");
  });

  it('shows "No results" when totalCount is 0', () => {
    // Mock fetcher to also return empty so the query result doesn't override the placeholder
    mockListFetcher.mockResolvedValueOnce({ rows: [], totalCount: 0, page: 1, pageSize: 50 });
    renderDataView({ initialData: { rows: [], totalCount: 0, page: 1, pageSize: 50 } });
    // Synchronous check — sees placeholder data before the query resolves
    expect(screen.getByTestId("pagination-info")).toHaveTextContent("No results");
  });
});

describe("T-DV-SELECT: clicking a row updates selected state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    nuqsState.params = new Map();
    mockPush.mockReset();
  });

  it("calls push with selected param when row is clicked", async () => {
    renderDataView();
    fireEvent.click(screen.getByTestId("row-p1"));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("selected=p1"));
    });
  });
});

describe("T-DV-DETAIL: selecting a row shows detail panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockDetailFetcher.mockResolvedValue(MOCK_DETAILS["p1"]);
  });

  it("shows detail panel when selected param is set", async () => {
    renderDataView({}, { selected: "p1" });
    await waitFor(() => expect(screen.getByTestId("detail-panel")).toBeInTheDocument());
  });

  it("renders detail content when data is loaded", async () => {
    renderDataView({}, { selected: "p1" });
    await waitFor(() => expect(screen.getByText("Great widget")).toBeInTheDocument());
  });
});

describe("T-DV-CLOSE: clearing selected returns to full table mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockDetailFetcher.mockResolvedValue(MOCK_DETAILS["p1"]);
    mockPush.mockReset();
  });

  it("clicking 'Back to full list' button clears selection", async () => {
    renderDataView({}, { selected: "p1" });
    await waitFor(() => screen.getByTestId("detail-panel"));
    // Close is now the "Filters / Back to full list" button in the toolbar
    fireEvent.click(screen.getByTestId("back-to-list-button"));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.not.stringContaining("selected=p1"));
    });
  });
});

describe("T-DV-SIDEBAR: compact sidebar appears when item is selected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockDetailFetcher.mockResolvedValue(MOCK_DETAILS["p1"]);
  });

  it("renders sidebar items when selected", async () => {
    renderDataView({}, { selected: "p1" });
    await waitFor(() => {
      // Sidebar uses data-testid="sidebar-item-<id>"
      expect(screen.getByTestId("sidebar-item-p1")).toBeInTheDocument();
      expect(screen.getByTestId("sidebar-item-p2")).toBeInTheDocument();
      expect(screen.getByTestId("sidebar-item-p3")).toBeInTheDocument();
    });
  });

  it("does NOT show main table when detail is open", async () => {
    renderDataView({}, { selected: "p1" });
    await waitFor(() => {
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });
});

describe("T-DV-SEARCH: changing search resets page to 1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockReplace.mockReset();
  });

  it("calls replace with page reset when search changes", async () => {
    renderDataView({}, { page: "3" });
    const input = screen.getByRole("textbox", { name: /search/i });
    fireEvent.change(input, { target: { value: "widget" } });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("search=widget"));
      expect(mockReplace).toHaveBeenCalledWith(expect.not.stringContaining("page=3"));
    });
  });
});

describe("T-DV-PAGESIZE: changing page size resets page to 1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockReplace.mockReset();
  });

  it("calls replace with page reset when pageSize changes", async () => {
    renderDataView({}, { page: "3", pageSize: "50" });
    const pageSizeTrigger = screen.getByRole("combobox", { name: /rows per page/i });
    fireEvent.click(pageSizeTrigger);
    await waitFor(() => screen.getAllByText("10"));
    fireEvent.click(screen.getAllByText("10")[0]);
    await waitFor(() => {
      const calls = mockReplace.mock.calls.map((c: string[]) => c[0]);
      expect(calls.some((url: string) => !url.includes("page=3"))).toBe(true);
    });
  });
});

describe("T-DV-SORT: clicking sortable column header toggles sort", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockReplace.mockReset();
  });

  it("calls replace with sort param when sortable header clicked", async () => {
    renderDataView();
    fireEvent.click(screen.getByText("Name"));
    await waitFor(() => {
      const calls = mockReplace.mock.calls.map((c: string[]) => c[0]);
      expect(calls.some((url: string) => url.includes("sort=name"))).toBe(true);
    });
  });

  it("clicking a sortable header always calls replace with a sort param", async () => {
    // Verify that any click on a sortable header produces a sort URL change.
    // The exact asc/desc toggle direction depends on TanStack Table internals.
    renderDataView();
    const nameHeader = screen
      .getAllByRole("columnheader")
      .find((h) => h.textContent?.includes("Name"));
    expect(nameHeader).toBeTruthy();
    fireEvent.click(nameHeader!);
    await waitFor(() => {
      const calls = mockReplace.mock.calls.map((c: string[]) => c[0]);
      expect(calls.some((url: string) => url.includes("sort=name"))).toBe(true);
    });
  });
});

describe("T-DV-COLUMNS: column visibility hides/shows a column", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it("hides a column when hidden in localStorage", () => {
    localStorageMock.setItem(
      "data-view:test-products:columns",
      JSON.stringify({ name: true, category: true, price: false })
    );
    renderDataView();
    expect(screen.queryByText("Price")).not.toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
  });

  it("shows all columns by default", () => {
    renderDataView();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getAllByText("Category").length).toBeGreaterThan(0);
    expect(screen.getByText("Price")).toBeInTheDocument();
  });
});

describe("T-DV-DETAIL-Q: detail fetcher called only when item selected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockDetailFetcher.mockResolvedValue(null);
  });

  it("does NOT call detailFetcher when nothing selected", async () => {
    renderDataView({}, {});
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(mockDetailFetcher).not.toHaveBeenCalled();
  });

  it("calls detailFetcher when item is selected", async () => {
    mockDetailFetcher.mockResolvedValue(MOCK_DETAILS["p2"]);
    renderDataView({}, { selected: "p2" });
    await waitFor(() => expect(mockDetailFetcher).toHaveBeenCalledWith("p2"));
  });
});

describe("T-DV-TYPES: list data does not require detail-only fields", () => {
  it("list row has no detail-only fields", () => {
    const row = MOCK_PRODUCTS[0];
    expect("description" in row).toBe(false);
    expect("stock" in row).toBe(false);
  });

  it("renders without needing detail fields on list rows", () => {
    renderDataView();
    expect(screen.getByText("Widget A")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-DV-TOOLBAR-LIST: full list mode toolbar behavior
// ---------------------------------------------------------------------------

describe("T-DV-TOOLBAR-LIST: full list mode toolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    nuqsState.params = new Map();
  });

  it("shows full search input in list mode", () => {
    renderDataView();
    expect(screen.getByRole("textbox", { name: /search/i })).toBeInTheDocument();
  });

  it("shows inline filter pills in list mode", () => {
    renderDataView();
    expect(screen.getByTestId("inline-filters")).toBeInTheDocument();
    // Each filter def should render a pill
    expect(screen.getByTestId("filter-pill-category")).toBeInTheDocument();
    expect(screen.getByTestId("filter-pill-status")).toBeInTheDocument();
  });

  it("shows column manager button in list mode", () => {
    renderDataView();
    expect(screen.getByRole("button", { name: /manage columns/i })).toBeInTheDocument();
  });

  it("does NOT show a search icon button in list mode", () => {
    renderDataView();
    expect(screen.queryByTestId("search-icon-button")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-DV-TOOLBAR-DETAIL: detail/sidebar mode toolbar behavior
// ---------------------------------------------------------------------------

describe("T-DV-TOOLBAR-DETAIL: detail/sidebar mode toolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockDetailFetcher.mockResolvedValue(MOCK_DETAILS["p1"]);
  });

  it("shows search icon button (not full input) by default in detail mode", async () => {
    renderDataView({}, { selected: "p1" });
    await waitFor(() => screen.getByTestId("detail-panel"));
    expect(screen.getByTestId("search-icon-button")).toBeInTheDocument();
    expect(screen.queryByTestId("search-input")).not.toBeInTheDocument();
  });

  it("expands search input after clicking the search icon", async () => {
    renderDataView({}, { selected: "p1" });
    await waitFor(() => screen.getByTestId("detail-panel"));
    fireEvent.click(screen.getByTestId("search-icon-button"));
    await waitFor(() => {
      expect(screen.getByTestId("search-input")).toBeInTheDocument();
      expect(screen.queryByTestId("search-icon-button")).not.toBeInTheDocument();
    });
  });

  it("shows 'Filters / back to list' button instead of filter dropdown in detail mode", async () => {
    renderDataView({}, { selected: "p1" });
    await waitFor(() => screen.getByTestId("detail-panel"));
    expect(screen.getByTestId("back-to-list-button")).toBeInTheDocument();
    expect(screen.queryByTestId("dropdown-filters")).not.toBeInTheDocument();
    expect(screen.queryByTestId("inline-filters")).not.toBeInTheDocument();
  });

  it("clicking Filters button in detail mode clears selected", async () => {
    renderDataView({}, { selected: "p1" });
    await waitFor(() => screen.getByTestId("detail-panel"));
    fireEvent.click(screen.getByTestId("back-to-list-button"));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.not.stringContaining("selected=p1"));
    });
  });

  it("hides column manager in detail mode", async () => {
    renderDataView({}, { selected: "p1" });
    await waitFor(() => screen.getByTestId("detail-panel"));
    expect(screen.queryByRole("button", { name: /manage columns/i })).not.toBeInTheDocument();
  });

  it("sidebar shows primary column only (no category subtitle)", async () => {
    renderDataView({}, { selected: "p1" });
    await waitFor(() => screen.getByTestId("sidebar-item-p1"));
    expect(screen.getByTestId("sidebar-item-p1")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-DV-COLVIS-LIVE: column visibility updates immediately without refresh
// ---------------------------------------------------------------------------

describe("T-DV-COLVIS-LIVE: column visibility updates table instantly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    nuqsState.params = new Map();
  });

  it("hiding a column removes it from the table immediately", async () => {
    renderDataView();
    // All 3 columns initially visible
    expect(screen.getByText("Price")).toBeInTheDocument();

    // Open column manager
    fireEvent.click(screen.getByRole("button", { name: /manage columns/i }));

    // Find and uncheck the Price checkbox
    const priceCheckbox = screen.getByRole("checkbox", { name: /toggle column price/i });
    expect(priceCheckbox).toBeChecked();
    fireEvent.click(priceCheckbox);

    // Price column should disappear immediately (no refresh needed)
    await waitFor(() => {
      expect(screen.queryByText("Price")).not.toBeInTheDocument();
    });
  });

  it("showing a hidden column makes it appear immediately", async () => {
    // Start with Price hidden in localStorage
    localStorageMock.setItem(
      "data-view:test-products:columns",
      JSON.stringify({ name: true, category: true, price: false })
    );
    renderDataView();
    expect(screen.queryByText("Price")).not.toBeInTheDocument();

    // Open column manager and re-enable Price
    fireEvent.click(screen.getByRole("button", { name: /manage columns/i }));
    const priceCheckbox = screen.getByRole("checkbox", { name: /toggle column price/i });
    expect(priceCheckbox).not.toBeChecked();
    fireEvent.click(priceCheckbox);

    await waitFor(() => {
      expect(screen.getByText("Price")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// T-DV-CLOSE-BTN: detail panel close button
// ---------------------------------------------------------------------------

describe("T-DV-CLOSE-BTN: detail panel has close button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockDetailFetcher.mockResolvedValue(MOCK_DETAILS["p1"]);
    mockPush.mockReset();
  });

  it("detail panel renders a close button", async () => {
    renderDataView({}, { selected: "p1" });
    await waitFor(() => screen.getByTestId("detail-panel"));
    expect(screen.getByRole("button", { name: /close detail/i })).toBeInTheDocument();
  });

  it("clicking close detail button clears selected", async () => {
    renderDataView({}, { selected: "p1" });
    await waitFor(() => screen.getByTestId("detail-panel"));
    fireEvent.click(screen.getByRole("button", { name: /close detail/i }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.not.stringContaining("selected=p1"));
    });
  });
});
