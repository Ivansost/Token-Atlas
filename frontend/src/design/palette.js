/**
 * The region palette: one hue per region of the vocabulary.
 *
 * Generated rather than hand-picked, for one reason -- THE AMBER LAW. Amber means "the model
 * chose this token" and may never mean anything else. A hand-picked set of a dozen hues would
 * eventually drift into the amber band and quietly break that rule, so the generator refuses to
 * emit anything inside it. The law is enforced by construction, not by discipline.
 *
 * Hues are spaced evenly around the remaining circle at constant lightness and modest chroma, so
 * no region shouts louder than its neighbours: these are ambient regions, not categories
 * competing for attention. The live layer still wins, but now it wins on brightness and size
 * rather than on being the only thing with colour.
 */

const RESERVED = [45, 95]   // the amber band, held for the chosen token
// Bloom lifts and desaturates whatever it touches, so the source colours are authored darker
// and more saturated than they should look -- they arrive on screen through the effect, not
// before it. Tuned by looking at the result, not at the swatches.
const LIGHTNESS = 0.56
const CHROMA = 0.15

/** `n` region colours as `oklch(...)` strings, none of them amber. */
export function regionHues(n) {
  const gapStart = RESERVED[0]
  const gapSize = RESERVED[1] - RESERVED[0]
  const usable = 360 - gapSize

  return Array.from({ length: n }, (_, i) => {
    let hue = (i * usable) / n
    // Skip the reserved band rather than compressing into it.
    if (hue >= gapStart) hue += gapSize
    return `oklch(${LIGHTNESS} ${CHROMA} ${hue.toFixed(1)})`
  })
}
