import { describe, expect, it, vi } from "vitest";
import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
import {
  DATA_VIEW_PAGE_SIZES,
  parseDataViewSearchParams,
  normalizeDataViewPage,
  recoverDataViewPage,
} from "../data-view-search-params";
import {
  dataViewKeys,
  getSelectionHistoryMode,
  invalidateDataViewList,
  invalidateDataViewEntity,
  synchronizeDataViewSidebarPage,
} from "../data-view-query-keys";
import { getInitialColumnVisibility } from "../data-view-columns";

describe("DataView shared search parameter contract", () => {
  it.each([
    ["50%", "50%"],
    ["%20", "%20"],
  ])("preserves filter text %s identically after server parsing", (input, expected) => {
    const filters = JSON.stringify({ name: input });
    const fromNextRecord = parseDataViewSearchParams({ filters });
    const fromUrl = parseDataViewSearchParams(
      new URLSearchParams({ filters }) as unknown as Record<string, string>
    );

    expect(fromNextRecord.filters).toEqual({ name: expected });
    expect(fromUrl.filters).toEqual(fromNextRecord.filters);
  });

  it("normalizes malformed and structurally invalid filters", () => {
    expect(parseDataViewSearchParams({ filters: "{" }).filters).toEqual({});
    expect(parseDataViewSearchParams({ filters: JSON.stringify({ count: 42 }) }).filters).toEqual(
      {}
    );
  });

  it("normalizes invalid pages and unsupported page sizes", () => {
    expect(parseDataViewSearchParams({ page: "-4", pageSize: "13" })).toMatchObject({
      page: 1,
      pageSize: 50,
    });
    expect(parseDataViewSearchParams({ page: "0", pageSize: "100" })).toMatchObject({
      page: 1,
      pageSize: 100,
    });
    expect(DATA_VIEW_PAGE_SIZES).toEqual([10, 25, 50, 100]);
    expect(normalizeDataViewPage(Number.NaN)).toBe(1);
  });

  it("recovers an out-of-range page to the nearest reported page", () => {
    expect(recoverDataViewPage(999, 126, 50)).toBe(3);
    expect(recoverDataViewPage(2, 0, 50)).toBe(1);
    expect(recoverDataViewPage(2, 100, 50)).toBe(2);
  });
});

describe("DataView canonical query and history contract", () => {
  const scope = { tenantId: "tenant-1", partitionId: "partition-1" };
  const params = {
    search: "bolt",
    sort: { field: "name", direction: "asc" as const },
    page: 2,
    pageSize: 25,
    filters: { status: ["active"] },
  };

  it("includes the entity and every normalized list input in the list key", () => {
    expect(dataViewKeys.list("inventory-products", scope, params)).toEqual([
      "data-view",
      "inventory-products",
      "scope",
      scope,
      "list",
      params,
    ]);
    expect(dataViewKeys.detail("inventory-products", scope, "product-1")).toEqual([
      "data-view",
      "inventory-products",
      "scope",
      scope,
      "detail",
      "product-1",
    ]);
  });

  it("isolates identical list and detail identities between scopes", () => {
    const scopeA = { tenantId: "tenant-1", partitionId: "partition-a" };
    const scopeB = { tenantId: "tenant-1", partitionId: "partition-b" };

    expect(dataViewKeys.list("inventory-products", scopeA, params)).not.toEqual(
      dataViewKeys.list("inventory-products", scopeB, params)
    );
    expect(dataViewKeys.detail("inventory-products", scopeA, "product-1")).not.toEqual(
      dataViewKeys.detail("inventory-products", scopeB, "product-1")
    );
  });

  it("accepts domain-agnostic primitive scopes and isolates every changed field", () => {
    const projectWorkspaceA = {
      projectId: "project-1",
      workspaceId: "workspace-1",
    };
    const projectWorkspaceB = {
      projectId: "project-1",
      workspaceId: "workspace-2",
    };
    const otherProject = {
      projectId: "project-2",
      workspaceId: "workspace-1",
    };

    expect(dataViewKeys.list("documents", projectWorkspaceA, params)).not.toEqual(
      dataViewKeys.list("documents", projectWorkspaceB, params)
    );
    expect(dataViewKeys.list("documents", projectWorkspaceA, params)).not.toEqual(
      dataViewKeys.list("documents", otherProject, params)
    );
  });

  it("pushes only the first detail and replaces switches and closes", () => {
    expect(getSelectionHistoryMode(null, "A")).toBe("push");
    expect(getSelectionHistoryMode("A", "B")).toBe("replace");
    expect(getSelectionHistoryMode("B", null)).toBe("replace");
  });

  it("invalidates only the requested entity query family", async () => {
    const queryClient = new QueryClient();
    const otherScope = { tenantId: "tenant-2" };
    queryClient.setQueryData(dataViewKeys.list("helpdesk-tickets", scope, params), { rows: [] });
    queryClient.setQueryData(dataViewKeys.detail("helpdesk-tickets", scope, "HD-1"), {
      id: "HD-1",
    });
    queryClient.setQueryData(dataViewKeys.list("helpdesk-tickets", otherScope, params), {
      rows: [],
    });

    await invalidateDataViewEntity(queryClient, "helpdesk-tickets", scope);

    expect(
      queryClient.getQueryState(dataViewKeys.list("helpdesk-tickets", scope, params))?.isInvalidated
    ).toBe(true);
    expect(
      queryClient.getQueryState(dataViewKeys.detail("helpdesk-tickets", scope, "HD-1"))
        ?.isInvalidated
    ).toBe(true);
    expect(
      queryClient.getQueryState(dataViewKeys.list("helpdesk-tickets", otherScope, params))
        ?.isInvalidated
    ).toBe(false);
  });

  it("resets an invalidated multi-page sidebar around the known-fresh list page", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = dataViewKeys.sidebar("inventory-products", scope, { ...params, page: 1 });
    const page1 = { rows: [{ id: "old-1" }], totalCount: 2, page: 1, pageSize: 1 };
    const page2 = { rows: [{ id: "old-2" }], totalCount: 2, page: 2, pageSize: 1 };
    queryClient.setQueryData(key, { pages: [page1, page2], pageParams: [1, 2] });

    await invalidateDataViewList(queryClient, "inventory-products", scope);
    const freshPage1 = { ...page1, rows: [{ id: "fresh-1" }] };
    synchronizeDataViewSidebarPage(
      queryClient,
      "inventory-products",
      scope,
      { ...params, page: 1 },
      freshPage1
    );

    expect(queryClient.getQueryData(key)).toEqual({ pages: [freshPage1], pageParams: [1] });

    const fetcher = vi.fn(async ({ pageParam }: { pageParam: unknown }) => ({
      ...page2,
      rows: [{ id: `fresh-${pageParam}` }],
    }));
    const observer = new InfiniteQueryObserver(queryClient, {
      queryKey: key,
      queryFn: fetcher,
      initialPageParam: 1,
      getNextPageParam: (lastPage) => (lastPage.page === 1 ? 2 : undefined),
    });
    await observer.fetchNextPage();

    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ pageParam: 2 }));
    expect(queryClient.getQueryData(key)).toEqual({
      pages: [freshPage1, { ...page2, rows: [{ id: "fresh-2" }] }],
      pageParams: [1, 2],
    });
  });

  it("preserves valid adjacent sidebar pages during a normal list synchronization", () => {
    const queryClient = new QueryClient();
    const key = dataViewKeys.sidebar("inventory-products", scope, { ...params, page: 1 });
    const page1 = { rows: [{ id: "old-1" }], totalCount: 2, page: 1, pageSize: 1 };
    const page2 = { rows: [{ id: "valid-2" }], totalCount: 2, page: 2, pageSize: 1 };
    const freshPage1 = { ...page1, rows: [{ id: "fresh-1" }] };
    queryClient.setQueryData(key, { pages: [page1, page2], pageParams: [1, 2] });

    synchronizeDataViewSidebarPage(
      queryClient,
      "inventory-products",
      scope,
      { ...params, page: 1 },
      freshPage1
    );

    expect(queryClient.getQueryData(key)).toEqual({
      pages: [freshPage1, page2],
      pageParams: [1, 2],
    });
  });
});

describe("DataView column defaults", () => {
  it("applies defaultVisible only when no stored preference exists", () => {
    const columns = [
      { key: "name", defaultVisible: true },
      { key: "internal", defaultVisible: false },
    ];

    expect(getInitialColumnVisibility(columns, {})).toEqual({ name: true, internal: false });
    expect(getInitialColumnVisibility(columns, { internal: true })).toEqual({
      name: true,
      internal: true,
    });
  });
});
