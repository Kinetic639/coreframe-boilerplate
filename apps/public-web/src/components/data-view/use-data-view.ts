"use client";

import { useContext, useMemo } from "react";
import {
  DataViewColumnsContext,
  DataViewDetailContext,
  DataViewListContext,
  DataViewSelectionContext,
  DataViewSidebarContext,
  DataViewStaticContext,
  DataViewUrlContext,
} from "./data-view-provider";

function requireContext<T>(value: T | null, name: string) {
  if (!value) {
    throw new Error(`${name} must be used within a DataViewProvider`);
  }
  return value;
}

export function useDataViewStatic() {
  return requireContext(useContext(DataViewStaticContext), "useDataViewStatic");
}

export function useDataViewUrl() {
  return requireContext(useContext(DataViewUrlContext), "useDataViewUrl");
}

export function useDataViewList() {
  return requireContext(useContext(DataViewListContext), "useDataViewList");
}

export function useDataViewColumns() {
  return requireContext(useContext(DataViewColumnsContext), "useDataViewColumns");
}

export function useDataViewSidebar() {
  return requireContext(useContext(DataViewSidebarContext), "useDataViewSidebar");
}

export function useDataViewSelection() {
  return requireContext(useContext(DataViewSelectionContext), "useDataViewSelection");
}

export function useDataViewDetail() {
  return requireContext(useContext(DataViewDetailContext), "useDataViewDetail");
}

/**
 * Legacy aggregate hook.
 * Prefer the smaller hooks above so components only subscribe to the state they need.
 */
export function useDataView() {
  const staticCtx = useDataViewStatic();
  const urlCtx = useDataViewUrl();
  const listCtx = useDataViewList();
  const columnsCtx = useDataViewColumns();
  const selectionCtx = useDataViewSelection();
  const sidebarCtx = useDataViewSidebar();
  const detailCtx = useDataViewDetail();

  return useMemo(
    () => ({
      ...staticCtx,
      ...urlCtx,
      ...listCtx,
      ...columnsCtx,
      ...selectionCtx,
      ...sidebarCtx,
      ...detailCtx,
    }),
    [columnsCtx, detailCtx, listCtx, selectionCtx, sidebarCtx, staticCtx, urlCtx]
  );
}
