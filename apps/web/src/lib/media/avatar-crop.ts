/**
 * Geometry of the avatar cropper: a square viewport over an image that always
 * covers it. `zoom` 1 = the image's shorter side fills the viewport; `x` / `y`
 * are how far (in viewport pixels) the image's centre is moved from the
 * viewport's centre.
 */

export interface CropImageSize {
  width: number;
  height: number;
}

export interface CropState {
  zoom: number;
  x: number;
  y: number;
}

export const CROP_MIN_ZOOM = 1;
export const CROP_MAX_ZOOM = 4;
/** Side of the saved avatar in pixels */
export const AVATAR_OUTPUT_SIZE = 512;

/** Displayed pixels per image pixel */
export function cropScale(image: CropImageSize, viewport: number, zoom: number): number {
  return (viewport / Math.min(image.width, image.height)) * zoom;
}

/** Keeps the zoom in range and the image covering the whole viewport */
export function clampCrop(image: CropImageSize, viewport: number, state: CropState): CropState {
  const zoom = Math.min(Math.max(state.zoom, CROP_MIN_ZOOM), CROP_MAX_ZOOM);
  const scale = cropScale(image, viewport, zoom);
  const maxX = Math.max((image.width * scale - viewport) / 2, 0);
  const maxY = Math.max((image.height * scale - viewport) / 2, 0);
  return {
    zoom,
    x: Math.min(Math.max(state.x, -maxX), maxX),
    y: Math.min(Math.max(state.y, -maxY), maxY),
  };
}

/**
 * Where the cropper starts: centred horizontally; a portrait photo is shown a
 * bit above its middle, because that is where the face usually is.
 */
export function initialCrop(image: CropImageSize, viewport: number): CropState {
  const scale = cropScale(image, viewport, CROP_MIN_ZOOM);
  const maxY = Math.max((image.height * scale - viewport) / 2, 0);
  return clampCrop(image, viewport, { zoom: CROP_MIN_ZOOM, x: 0, y: maxY * 0.5 });
}

/** The square of the original image (in image pixels) visible in the viewport */
export function cropSourceRect(
  image: CropImageSize,
  viewport: number,
  state: CropState
): { sx: number; sy: number; size: number } {
  const { zoom, x, y } = clampCrop(image, viewport, state);
  const scale = cropScale(image, viewport, zoom);
  const size = viewport / scale;
  return {
    sx: image.width / 2 - x / scale - size / 2,
    sy: image.height / 2 - y / scale - size / 2,
    size,
  };
}

/** Zooming keeps the point in the middle of the viewport where it is */
export function zoomCrop(
  image: CropImageSize,
  viewport: number,
  state: CropState,
  zoom: number
): CropState {
  const next = Math.min(Math.max(zoom, CROP_MIN_ZOOM), CROP_MAX_ZOOM);
  const ratio = next / state.zoom;
  return clampCrop(image, viewport, { zoom: next, x: state.x * ratio, y: state.y * ratio });
}
