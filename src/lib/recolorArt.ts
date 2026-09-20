/** Site silhouette fills — never mechanism hues. */
const CHARCOAL = [58, 53, 50] as const
const BLUSH = [234, 213, 208] as const
const BLUSH_DEEP = [217, 184, 178] as const
const STONE = [138, 127, 122] as const

function lum(r: number, g: number, b: number) {
  return (r * 299 + g * 587 + b * 114) / 1000
}

function write(
  d: Uint8ClampedArray,
  i: number,
  rgb: readonly [number, number, number],
  a = 255,
) {
  d[i] = rgb[0]
  d[i + 1] = rgb[1]
  d[i + 2] = rgb[2]
  d[i + 3] = a
}

function remapSitting(r: number, g: number, b: number, a: number): readonly [number, number, number, number] {
  if (a < 12) return [0, 0, 0, 0]
  const L = lum(r, g, b)
  if (L > 236 && r > 232 && g > 226 && b > 216) return [0, 0, 0, 0]
  if (L < 72) return [...CHARCOAL, 255]

  const yellow = r > 145 && g > 110 && b < 155 && r + g > 2 * b + 30
  const brown = L < 155 && r > g + 8 && g > b && r - b > 35

  if (brown) return [...STONE, 255]
  if (yellow) return [...BLUSH_DEEP, 255]
  if (L > 165) return [...BLUSH, 255]
  return [...CHARCOAL, 255]
}

function remapStanding(r: number, g: number, b: number, a: number): readonly [number, number, number, number] {
  if (a < 12) return [0, 0, 0, 0]
  const L = lum(r, g, b)
  if (L > 228) return [0, 0, 0, 0]
  const t = Math.min(1, Math.max(0, (210 - L) / 180))
  return [...CHARCOAL, Math.round(255 * t)]
}

export function recolorSilhouette(
  img: HTMLImageElement,
  kind: 'sitting' | 'standing',
): string {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return img.src
  ctx.drawImage(img, 0, 0)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = image.data
  const remap = kind === 'sitting' ? remapSitting : remapStanding
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b, a] = remap(d[i], d[i + 1], d[i + 2], d[i + 3])
    write(d, i, [r, g, b], a)
  }
  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}
