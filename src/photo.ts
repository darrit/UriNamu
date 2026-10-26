export const portraitRatio = 6 / 7;

export type Crop = { x: number; y: number; width: number; height: number };
export type CropSample = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
};

export function cropRegion(
  width: number,
  height: number,
  zoom: number,
  x: number,
  y: number,
): Crop {
  // x/y is the center of the portrait frame, in image fractions.
  // Zoom below 1 makes that frame larger than the picture; the overflow stays empty.
  const scale = Math.max(0.1, Math.min(8, zoom));
  const cropHeight = Math.min(width, height) / scale;
  const cropWidth = cropHeight * portraitRatio;
  return {
    x: width * x - cropWidth / 2,
    y: height * y - cropHeight / 2,
    width: cropWidth,
    height: cropHeight,
  };
}

/** Maps the part of the picture that lies inside the portrait frame. */
export function cropSample(
  imageWidth: number,
  imageHeight: number,
  crop: Crop,
  outputWidth: number,
  outputHeight: number,
): CropSample | null {
  const sx = Math.max(0, crop.x);
  const sy = Math.max(0, crop.y);
  const right = Math.min(imageWidth, crop.x + crop.width);
  const bottom = Math.min(imageHeight, crop.y + crop.height);
  const sw = right - sx;
  const sh = bottom - sy;
  if (sw <= 0 || sh <= 0 || crop.width <= 0 || crop.height <= 0) return null;
  const scaleX = outputWidth / crop.width;
  const scaleY = outputHeight / crop.height;
  return {
    sx,
    sy,
    sw,
    sh,
    dx: (sx - crop.x) * scaleX,
    dy: (sy - crop.y) * scaleY,
    dw: sw * scaleX,
    dh: sh * scaleY,
  };
}
