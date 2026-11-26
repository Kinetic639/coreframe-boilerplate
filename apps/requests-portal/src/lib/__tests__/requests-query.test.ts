import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { RequestListItem } from "@/server/requests/types";
import type { RequestView } from "@/server/requests/view.service";
import {
  isReplying,
  patchRequest,
  replyFinished,
  replyStarted,
  requestKeys,
  restore,
  type ListData,
} from "../requests-query";

const item = (id: string, patch: Partial<RequestListItem> = {}): RequestListItem => ({
  id,
  number: `HD-${id}`,
  title: `Request ${id}`,
  state: "new",
  type: null,
  branchId: "b1",
  requester: null,
  order: null,
  commentCount: 0,
  createdAt: "2026-11-26T10:00:00Z",
  updatedAt: "2026-11-26T10:00:00Z",
  isMine: true,
  ...patch,
});

const scope = "org:all";

function seed() {
  const qc = new QueryClient();
  qc.setQueryData<ListData>(requestKeys.list(scope, ""), {
    items: [item("1"), item("2")],
    total: 2,
  });
  qc.setQueryData<ListData>(requestKeys.list(scope, "f=closed"), { items: [item("3")], total: 1 });
  qc.setQueryData<RequestView>(requestKeys.detail(scope, "1"), {
    request: {
      ...item("1"),
      status: "open",
      descriptionPlain: null,
      descriptionRich: null,
      responders: [],
      acceptors: [],
      acceptedAt: null,
      closedAt: null,
      canClose: true,
    },
    events: [],
    comments: [],
    attachments: [],
  });
  return qc;
}

describe("patchRequest", () => {
  it("changes the request in every cached list page and its card", () => {
    const qc = seed();
    patchRequest(qc, scope, "1", { state: "closed", status: "closed", canClose: false });
    const list = qc.getQueryData<ListData>(requestKeys.list(scope, ""));
    expect(list?.items.map((i) => i.state)).toEqual(["closed", "new"]);
    const view = qc.getQueryData<RequestView>(requestKeys.detail(scope, "1"));
    expect(view?.request.status).toBe("closed");
    expect(view?.request.canClose).toBe(false);
  });

  it("leaves pages without the request untouched and restores the snapshot", () => {
    const qc = seed();
    const before = qc.getQueryData<ListData>(requestKeys.list(scope, "f=closed"));
    const snapshot = patchRequest(qc, scope, "1", { title: "Changed" });
    expect(snapshot).toHaveLength(2);
    expect(qc.getQueryData(requestKeys.list(scope, "f=closed"))).toBe(before);
    restore(qc, snapshot);
    expect(qc.getQueryData<ListData>(requestKeys.list(scope, ""))?.items[0]?.title).toBe(
      "Request 1"
    );
    expect(qc.getQueryData<RequestView>(requestKeys.detail(scope, "1"))?.request.title).toBe(
      "Request 1"
    );
  });

  it("does not touch another branch scope", () => {
    const qc = seed();
    qc.setQueryData<ListData>(requestKeys.list("org:b2", ""), { items: [item("1")], total: 1 });
    patchRequest(qc, scope, "1", { title: "Changed" });
    expect(qc.getQueryData<ListData>(requestKeys.list("org:b2", ""))?.items[0]?.title).toBe(
      "Request 1"
    );
  });
});

describe("replies in flight", () => {
  it("counts overlapping replies per request", () => {
    replyStarted("1");
    replyStarted("1");
    replyFinished("1");
    expect(isReplying("1")).toBe(true);
    replyFinished("1");
    expect(isReplying("1")).toBe(false);
  });
});
