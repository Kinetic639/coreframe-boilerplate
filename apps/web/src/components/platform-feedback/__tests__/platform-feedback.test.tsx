/**
 * @vitest-environment jsdom
 *
 * Platform feedback UI: the report dialog sends the report with its browser
 * context, uploads the files into the report's folder and records them; the
 * detail panel shows status / priority / internal notes only to the admin and
 * sends an answer with its files.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import plMessages from "../../../../messages/pl.json";
import type { FeedbackDetail } from "@/lib/platform-feedback/types";

const actions = vi.hoisted(() => ({
  createFeedbackAction: vi.fn(),
  registerFeedbackFilesAction: vi.fn(),
  addFeedbackMessageAction: vi.fn(),
  updateFeedbackAction: vi.fn(),
  getFeedbackAction: vi.fn(),
  listFeedbackAction: vi.fn(),
}));
const upload = vi.hoisted(() => ({ uploadFeedbackFiles: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));

vi.mock("@/app/actions/platform-feedback", () => actions);
vi.mock("@/lib/platform-feedback/upload", () => upload);
vi.mock("react-toastify", () => ({ toast }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.unmock("next-intl");
// The rich-text editor needs a real DOM editor; a textarea stands in for it.
vi.mock("@/components/primitives/rich-text/rich-text-editor-field", () => ({
  RichTextEditorField: ({
    onChange,
    placeholder,
  }: {
    onChange: (value: unknown) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label={placeholder}
      onChange={(event) =>
        onChange({
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: event.target.value }] }],
        })
      }
    />
  ),
}));

import { ReportFeedbackDialog } from "../report-feedback-dialog";
import { FeedbackDetailPanel } from "../feedback-detail-panel";

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pl" messages={plMessages} timeZone="Europe/Warsaw">
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

const DETAIL: FeedbackDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  number: 7,
  code: "ZG-0007",
  kind: "bug",
  title: "Skaner nie łapie QR",
  body_rich: null,
  body_plain: "",
  status: "new",
  priority: "normal",
  created_at: "2026-11-03T10:00:00Z",
  resolved_at: null,
  context: {
    url: "https://app.example/dashboard/start",
    path: "/dashboard/start",
    userAgent: "UA",
  },
  reporter: { id: "u1", name: "Oskar", email: "o@example.com", avatar_url: null },
  organization_name: "Ambra – testy",
  branch_name: "Oddział A",
  messages: [
    {
      id: "m1",
      body_rich: null,
      body_plain: "notatka",
      is_internal: true,
      created_at: "2026-11-03T10:05:00Z",
      author: { id: "a1", name: "Michał", email: null, avatar_url: null, is_admin: true },
    },
  ],
  attachments: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  actions.getFeedbackAction.mockResolvedValue({ success: true, data: DETAIL });
});

describe("ReportFeedbackDialog", () => {
  it("sends the report with the page it came from, then uploads and records its files", async () => {
    actions.createFeedbackAction.mockResolvedValue({
      success: true,
      data: { id: DETAIL.id, number: 7 },
    });
    upload.uploadFeedbackFiles.mockResolvedValue({
      uploaded: [{ path: `${DETAIL.id}/a.png`, name: "zrzut.png", type: "image/png", size: 10 }],
      rejected: [],
    });
    actions.registerFeedbackFilesAction.mockResolvedValue({
      success: true,
      data: { registered: 1, rejected: [] },
    });
    const onOpenChange = vi.fn();
    wrap(<ReportFeedbackDialog open onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /Propozycja/ }));
    fireEvent.change(screen.getByLabelText("Tytuł"), { target: { value: "Lepszy filtr" } });
    const file = new File(["x"], "zrzut.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("report-feedback-submit"));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(actions.createFeedbackAction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "idea",
        title: "Lepszy filtr",
        context: expect.objectContaining({ path: window.location.pathname }),
      })
    );
    expect(upload.uploadFeedbackFiles).toHaveBeenCalledWith(DETAIL.id, [file]);
    expect(actions.registerFeedbackFilesAction).toHaveBeenCalledWith({
      feedbackId: DETAIL.id,
      messageId: null,
      files: [{ path: `${DETAIL.id}/a.png`, name: "zrzut.png", type: "image/png", size: 10 }],
    });
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("ZG-0007"),
      expect.anything()
    );
  });

  it("cannot be sent without a title", () => {
    wrap(<ReportFeedbackDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("report-feedback-submit")).toBeDisabled();
  });
});

describe("FeedbackDetailPanel", () => {
  it("shows the admin status, priority, context and internal notes", () => {
    wrap(<FeedbackDetailPanel initial={DETAIL} isAdmin />);
    expect(screen.getByTestId("feedback-admin-controls")).toBeInTheDocument();
    expect(screen.getByTestId("feedback-context")).toHaveTextContent("/dashboard/start");
    expect(screen.getByText("Prywatna · tylko Ty", { selector: "span" })).toBeInTheDocument();
  });

  it("hides admin controls and context from the reporter", () => {
    wrap(<FeedbackDetailPanel initial={{ ...DETAIL, messages: [] }} isAdmin={false} />);
    expect(screen.queryByTestId("feedback-admin-controls")).toBeNull();
    expect(screen.queryByTestId("feedback-context")).toBeNull();
    expect(screen.queryByText("Prywatna · tylko Ty")).toBeNull();
  });

  it("sends an answer and records its files on that message", async () => {
    actions.addFeedbackMessageAction.mockResolvedValue({ success: true, data: { id: "m2" } });
    upload.uploadFeedbackFiles.mockResolvedValue({
      uploaded: [{ path: `${DETAIL.id}/b.pdf`, name: "log.pdf", type: "application/pdf", size: 5 }],
      rejected: [],
    });
    actions.registerFeedbackFilesAction.mockResolvedValue({
      success: true,
      data: { registered: 1, rejected: [] },
    });
    wrap(<FeedbackDetailPanel initial={DETAIL} isAdmin={false} />);

    fireEvent.change(screen.getByLabelText("Napisz odpowiedź…"), { target: { value: "Dzięki" } });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["%PDF"], "log.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByTestId("feedback-send"));

    await waitFor(() =>
      expect(actions.registerFeedbackFilesAction).toHaveBeenCalledWith(
        expect.objectContaining({ feedbackId: DETAIL.id, messageId: "m2" })
      )
    );
    expect(actions.addFeedbackMessageAction).toHaveBeenCalledWith(
      expect.objectContaining({ feedbackId: DETAIL.id, bodyPlain: "Dzięki", isInternal: false })
    );
  });
});
