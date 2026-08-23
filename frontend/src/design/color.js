/**
 * OKLCH -> hex, for Three.js.
 *
 * The design tokens are authored in OKLCH because lightness and chroma move predictably there,
 * which is what makes a ramp behave when a theme remaps it. CSS understands those strings; the
 * WebGL layer does not -- Three.Color.setStyle has no OKLCH parser, and reading the computed
 * style back from the DOM returns the value in whatever form the browser prefers, which differs
 * between browsers. Converting here keeps one answer everywhere.
 *
 * Maths: OKLCH -> OKLab -> linear sRGB -> gamma-encoded sRGB, per Björn Ottosson's definition.
 */

const OKLCH = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/i

function encode(channel) {
  const c = Math.min(1, Math.max(0, channel))
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

const cache = new Map()
const rgbCache = new Map()

/** `oklch(0.80 0.14 70)` -> `0xrrggbb`, cached. Non-OKLCH strings pass through untouched. */
export function toHex(value) {
  if (cache.has(value)) return cache.get(value)

  const match = OKLCH.exec(value)
  if (!match) return value

  const L = parseFloat(match[1])
  const C = parseFloat(match[2])
  const hRad = (parseFloat(match[3]) * Math.PI) / 180

  const a = C * Math.cos(hRad)
  const b = C * Math.sin(hRad)

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3

  const rgb = [
    encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    encode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]

  const hex = rgb.reduce((acc, channel) => (acc << 8) | Math.round(channel * 255), 0)
  cache.set(value, hex)
  return hex
}

/**
 * `oklch(...)` -> `[r, g, b]` in 0..1, for per-vertex colour buffers.
 *
 * Three's vertex colours want linear-ish floats per channel rather than a packed integer, and
 * building a 151,665 x 3 buffer means this runs a lot -- hence the second cache.
 */
export function toRGB(value) {
  if (rgbCache.has(value)) return rgbCache.get(value)
  const hex = toHex(value)
  const rgb = [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]
  rgbCache.set(value, rgb)
  return rgb
}
