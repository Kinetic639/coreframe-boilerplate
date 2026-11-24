import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadAttachmentFile = vi.fn();

vi.mock("../direct-upload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../direct-upload")>();
  return { ...actual, uploadAttachmentFile: (...args: unknown[]) => uploadAttachmentFile(...args) };
});

import { withKnownType } from "../direct-upload";
import { useStagedAttachmentUploads } from "../use-staged-attachment-uploads";

function photo(name = "IMG_1.jpg", type = "image/jpeg") {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

function payload(name: string) {
  return { storagePath: `org/user/${name}`, fileName: name, contentType: "image/jpeg", size: 3 };
}

describe("withKnownType", () => {
  it("guesses a missing type from the name (Android pickers)", () => {
    expect(withKnownType(photo("IMG_2.JPG", "")).type).toBe("image/jpeg");
    expect(withKnownType(photo("a.png", "application/octet-stream")).type).toBe("image/png");
  });

  it("keeps a type the browser gave", () => {
    expect(withKnownType(photo("a.jpg", "image/webp")).type).toBe("image/webp");
  });
});

describe("useStagedAttachmentUploads", () => {
  beforeEach(() => {
    uploadAttachmentFile.mockReset();
  });

  it("starts uploading as soon as a file is picked", async () => {
    uploadAttachmentFile.mockResolvedValue(payload("a.jpg"));
    const { result } = renderHook(() => useStagedAttachmentUploads("org"));

    await act(() => result.current.add([photo()]));

    expect(uploadAttachmentFile).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.items[0]?.status).toBe("done"));
    const outcome = await result.current.settled();
    expect(outcome).toEqual({ payloads: [payload("a.jpg")], failed: 0 });
  });

  it("waits for files still on their way", async () => {
    let finish: (value: unknown) => void = () => {};
    uploadAttachmentFile.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { result } = renderHook(() => useStagedAttachmentUploads("org"));

    await act(() => result.current.add([photo()]));
    expect(result.current.uploading).toBe(1);

    const settled = result.current.settled();
    await act(async () => finish(payload("a.jpg")));
    await expect(settled).resolves.toEqual({ payloads: [payload("a.jpg")], failed: 0 });
  });

  it("reports a failed file and sends it again on retry", async () => {
    uploadAttachmentFile.mockRejectedValueOnce(new Error("Network error"));
    uploadAttachmentFile.mockResolvedValueOnce(payload("a.jpg"));
    const { result } = renderHook(() => useStagedAttachmentUploads("org"));

    await act(() => result.current.add([photo()]));
    await waitFor(() => expect(result.current.failed).toBe(1));
    expect((await result.current.settled()).failed).toBe(1);

    act(() => result.current.retry(result.current.items[0].id));
    await waitFor(() => expect(result.current.items[0].status).toBe("done"));
    expect(uploadAttachmentFile).toHaveBeenCalledTimes(2);
  });

  it("refuses files of a type that cannot be attached", async () => {
    const { result } = renderHook(() => useStagedAttachmentUploads("org"));
    let problem: unknown;
    await act(async () => {
      problem = await result.current.add([photo("a.heic", "image/heic")]);
    });
    expect(problem).toBe("typeNotAllowed");
    expect(result.current.items).toHaveLength(0);
    expect(uploadAttachmentFile).not.toHaveBeenCalled();
  });

  it("leaves a removed file out of the result", async () => {
    uploadAttachmentFile.mockImplementation(async ({ file }: { file: File }) => payload(file.name));
    const { result } = renderHook(() => useStagedAttachmentUploads("org"));

    await act(() => result.current.add([photo("a.jpg"), photo("b.jpg")]));
    await waitFor(() => expect(result.current.uploading).toBe(0));
    act(() => result.current.remove(result.current.items[0].id));

    expect((await result.current.settled()).payloads).toEqual([payload("b.jpg")]);
  });
});
