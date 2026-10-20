/**
 * @vitest-environment jsdom
 *
 * Phones: the header's scan button opens the global scanner in one tap.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/components/features/qr/scan-feedback", () => ({ unlockScanSound: vi.fn() }));

import { GlobalScanTrigger } from "../global-search-trigger";
import { useGlobalSearchStore } from "../global-search-store";

describe("GlobalScanTrigger", () => {
  it("opens the palette straight in the scanner", () => {
    useGlobalSearchStore.setState({ open: false, initialQuery: "", scanOnOpen: false });
    render(<GlobalScanTrigger />);
    fireEvent.click(screen.getByTestId("global-scan-trigger"));
    expect(useGlobalSearchStore.getState()).toMatchObject({ open: true, scanOnOpen: true });
  });

  it("a normal opening (Ctrl+K, search icon) does not start the camera", () => {
    useGlobalSearchStore.getState().openScanner();
    useGlobalSearchStore.getState().setOpen(false);
    useGlobalSearchStore.getState().setOpen(true);
    expect(useGlobalSearchStore.getState().scanOnOpen).toBe(false);
  });
});
