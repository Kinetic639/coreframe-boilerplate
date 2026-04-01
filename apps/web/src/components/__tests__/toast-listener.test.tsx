import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const replaceMock = vi.fn();
const getMock = vi.fn();
const toStringMock = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () =>
    ({
      get: getMock,
      toString: toStringMock,
    }) as unknown as URLSearchParams,
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `translated:${key}`,
}));

import { ToastListener } from "../toast-listener";
import { toast } from "react-toastify";

describe("ToastListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockReturnValue(null);
    toStringMock.mockReturnValue("");
    window.history.pushState({}, "", "/settings");
  });

  it("does nothing when there is no toast query param", async () => {
    render(<ToastListener />);

    await waitFor(() => {
      expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
      expect(replaceMock).not.toHaveBeenCalled();
    });
  });

  it("shows a translated toast and removes the query param", async () => {
    getMock.mockReturnValue("password-updated");
    toStringMock.mockReturnValue("toast=password-updated&foo=bar");

    render(<ToastListener />);

    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("translated:toasts.passwordUpdated")
    );
    expect(replaceMock).toHaveBeenCalledWith("?foo=bar", { scroll: false });
  });

  it("ignores unknown toast keys", async () => {
    getMock.mockReturnValue("unknown-toast");
    toStringMock.mockReturnValue("toast=unknown-toast");

    render(<ToastListener />);

    await waitFor(() => {
      expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
      expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
      expect(replaceMock).not.toHaveBeenCalled();
    });
  });
});
