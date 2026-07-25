import { describe, it, expect, vi } from "vitest";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    promise: vi.fn(),
    loading: vi.fn(),
    update: vi.fn(),
    dismiss: vi.fn(),
  },
}));

import { toastPatterns } from "../toast-patterns";
import { toast } from "react-toastify";

describe("toastPatterns", () => {
  it("uses default success options and icon", () => {
    toastPatterns.success("Saved");

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "Saved",
      expect.objectContaining({
        position: "bottom-right",
        autoClose: 2500,
        icon: expect.anything(),
      })
    );
  });

  it("uses longer auto close for errors", () => {
    toastPatterns.error("Failed");

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "Failed",
      expect.objectContaining({
        autoClose: 3500,
      })
    );
  });

  it("passes through promise, loading, update, and dismiss helpers", async () => {
    const promise = Promise.resolve("ok");
    toastPatterns.promise(promise, {
      pending: "Loading",
      success: "Done",
      error: "Failed",
    });
    toastPatterns.loading("Loading");
    toastPatterns.update("toast-1", { autoClose: 1000 });
    toastPatterns.dismiss("toast-1");
    toastPatterns.dismiss();

    expect(vi.mocked(toast.promise)).toHaveBeenCalled();
    expect(vi.mocked(toast.loading)).toHaveBeenCalledWith(
      "Loading",
      expect.objectContaining({ autoClose: false })
    );
    expect(vi.mocked(toast.update)).toHaveBeenCalledWith("toast-1", { autoClose: 1000 });
    expect(vi.mocked(toast.dismiss)).toHaveBeenCalledWith("toast-1");
    expect(vi.mocked(toast.dismiss)).toHaveBeenCalledWith();
  });

  it("covers the common convenience helpers", () => {
    toastPatterns.saved("Profile");
    toastPatterns.deleted();
    toastPatterns.created("Role");
    toastPatterns.updated("Branch");
    toastPatterns.copied();
    toastPatterns.networkError();
    toastPatterns.permissionDenied();
    toastPatterns.validationError();
    toastPatterns.validationError("Custom validation");

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Profile saved successfully");
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Item deleted successfully");
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Role created successfully");
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Branch updated successfully");
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Copied to clipboard");
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "Network error. Please check your connection and try again."
    );
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "You don't have permission to perform this action."
    );
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Please check your input and try again.");
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Custom validation");
  });
});
