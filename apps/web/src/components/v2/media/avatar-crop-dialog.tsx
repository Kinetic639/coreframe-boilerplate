"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  AVATAR_OUTPUT_SIZE,
  CROP_MAX_ZOOM,
  CROP_MIN_ZOOM,
  clampCrop,
  cropScale,
  cropSourceRect,
  initialCrop,
  zoomCrop,
  type CropImageSize,
  type CropState,
} from "@/lib/media/avatar-crop";

const VIEWPORT = 280;
const KEY_STEP = 12;

interface LoadedImage extends CropImageSize {
  url: string;
  element: HTMLImageElement;
}

/**
 * Framing of a profile photo before it is uploaded: the picked image is shown
 * in a square with a round guide; drag (or arrow keys) moves it, the slider /
 * wheel / + − zoom. "Save" hands back a square 512 px JPEG, so avatars are
 * never stretched and the face is where the person put it.
 */
export function AvatarCropDialog({
  file,
  onCancel,
  onConfirm,
}: {
  /** The picked image; the dialog is open while this is set */
  file: File | null;
  onCancel: () => void;
  onConfirm: (cropped: File) => void | Promise<void>;
}) {
  const t = useTranslations("avatarCrop");
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [failed, setFailed] = useState(false);
  const [crop, setCrop] = useState<CropState>({ zoom: 1, x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: CropState;
  } | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const element = new Image();
    let active = true;
    element.onload = () => {
      if (!active) return;
      const size = { width: element.naturalWidth, height: element.naturalHeight };
      setImage({ ...size, url, element });
      setCrop(initialCrop(size, VIEWPORT));
    };
    element.onerror = () => {
      if (active) setFailed(true);
    };
    element.src = url;
    return () => {
      active = false;
      URL.revokeObjectURL(url);
      setImage(null);
      setFailed(false);
    };
  }, [file]);

  const move = (dx: number, dy: number) => {
    if (image)
      setCrop((state) =>
        clampCrop(image, VIEWPORT, { ...state, x: state.x + dx, y: state.y + dy })
      );
  };
  const zoomTo = (zoom: number) => {
    if (image) setCrop((state) => zoomCrop(image, VIEWPORT, state, zoom));
  };

  const save = async () => {
    if (!image || saving) return;
    setSaving(true);
    try {
      const { sx, sy, size } = cropSourceRect(image, VIEWPORT, crop);
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_OUTPUT_SIZE;
      canvas.height = AVATAR_OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no canvas");
      // Transparent PNGs get a white background in the JPEG
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image.element,
        sx,
        sy,
        size,
        size,
        0,
        0,
        AVATAR_OUTPUT_SIZE,
        AVATAR_OUTPUT_SIZE
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9)
      );
      if (!blob) throw new Error("no blob");
      await onConfirm(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const scale = image ? cropScale(image, VIEWPORT, crop.zoom) : 1;

  return (
    <Dialog
      open={!!file}
      onOpenChange={(open) => {
        if (!open && !saving) onCancel();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("hint")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <div
            role="application"
            aria-label={t("area")}
            tabIndex={0}
            data-testid="avatar-crop-area"
            className="relative touch-none select-none overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ width: VIEWPORT, height: VIEWPORT, cursor: image ? "grab" : "default" }}
            onPointerDown={(event) => {
              if (!image) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                origin: crop,
              };
            }}
            onPointerMove={(event) => {
              const current = drag.current;
              if (!image || !current || current.pointerId !== event.pointerId) return;
              setCrop(
                clampCrop(image, VIEWPORT, {
                  zoom: current.origin.zoom,
                  x: current.origin.x + event.clientX - current.startX,
                  y: current.origin.y + event.clientY - current.startY,
                })
              );
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onWheel={(event) => zoomTo(crop.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08))}
            onKeyDown={(event) => {
              const moves: Record<string, [number, number]> = {
                ArrowLeft: [KEY_STEP, 0],
                ArrowRight: [-KEY_STEP, 0],
                ArrowUp: [0, KEY_STEP],
                ArrowDown: [0, -KEY_STEP],
              };
              const delta = moves[event.key];
              if (delta) {
                event.preventDefault();
                move(delta[0], delta[1]);
              } else if (event.key === "+" || event.key === "=") {
                zoomTo(crop.zoom * 1.1);
              } else if (event.key === "-") {
                zoomTo(crop.zoom / 1.1);
              }
            }}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local object URL being framed
              <img
                src={image.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{
                  width: image.width * scale,
                  height: image.height * scale,
                  transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px))`,
                }}
              />
            ) : failed ? (
              <p className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                {t("loadFailed")}
              </p>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            )}
            {/* Round guide: avatars are shown as circles or rounded squares */}
            {image ? (
              <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] ring-1 ring-white/70" />
            ) : null}
          </div>

          <div className="flex w-full items-center gap-2" style={{ maxWidth: VIEWPORT }}>
            <ZoomOut className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Slider
              aria-label={t("zoom")}
              min={CROP_MIN_ZOOM}
              max={CROP_MAX_ZOOM}
              step={0.01}
              value={[crop.zoom]}
              disabled={!image}
              onValueChange={([value]) => zoomTo(value ?? CROP_MIN_ZOOM)}
            />
            <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={() => void save()} disabled={!image || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
