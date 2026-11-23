/**
 * On-device capture quality scoring.
 *
 * Input is ONE byte per pixel of grayscale luminance (0..255), sampled on a
 * 64x64 grid by the field WebView. The merged capture contract applies its
 * blur/light gates to the normalised [0,1] outputs here; it does not inspect
 * raw pixels. These numbers are capture guidance, not calibrated device evidence.
 */

/** Squared full-scale Laplacian response for an 8-bit sample. */
const LAPLACIAN_SCALE = 255 * 255

export type QualityScore = { blurScore: number; lightScore: number }

export function scorePixels(pixels: Uint8ClampedArray, width: number, height: number): QualityScore {
  if (
    !Number.isFinite(width) || !Number.isFinite(height) ||
    !Number.isInteger(width) || !Number.isInteger(height) ||
    width <= 2 || height <= 2 || pixels.length !== width * height
  ) {
    return { blurScore: 0, lightScore: 0 }
  }

  let luminanceSum = 0
  for (let index = 0; index < pixels.length; index += 1) luminanceSum += pixels[index]
  const lightScore = luminanceSum / pixels.length / 255

  let squaredResponseSum = 0
  let sampleCount = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x
      // Standard 3x3 Laplacian [0,1,0;1,-4,1;0,1,0] on the 4-neighbours.
      const response = pixels[index - width] + pixels[index - 1] + pixels[index + 1] + pixels[index + width] - 4 * pixels[index]
      squaredResponseSum += response * response
      sampleCount += 1
    }
  }

  const meanSquaredResponse = squaredResponseSum / sampleCount
  const blurScore = 1 / (1 + meanSquaredResponse / LAPLACIAN_SCALE)
  return { blurScore, lightScore }
}
