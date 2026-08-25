/**
 * Design tokens: the single source of truth for colour, type, and spacing.
 *
 * Nothing in this app may hardcode a colour. The
 * scene reads these values for its Three.js materials, and `applyTokens` publishes the same
 * values as CSS custom properties so the chrome uses them too. One definition, two consumers.
 *
 * That discipline is what makes the theme switcher (an icon-rail panel) cheap later: a theme is
 * a remapping of these role names, not a search-and-replace through components.
 *
 * Role names describe PURPOSE, never appearance. `chosen` is "the token the model emitted", not
 * "the amber one" -- so a theme may make it any colour without the name becoming a lie.
 */

export const theme = {
  name: 'memory-towers',

  color: {
    // --- the room ---
    void: 'oklch(0.13 0.022 265)',        // page and scene ground; deliberately identical
    voidDeep: 'oklch(0.09 0.020 265)',    // fog at distance; objects fade to this, never to black

    // --- chrome, three elevation steps (real lightness values, never one colour at 3 opacities) ---
    surfaceRail: 'oklch(0.16 0.020 265)',
    surfacePanel: 'oklch(0.19 0.022 265)',
    surfaceRaised: 'oklch(0.24 0.024 265)',
    borderHair: 'oklch(0.30 0.020 265)',

    // --- text, all verified above WCAG AA on surfacePanel ---
    textPrimary: 'oklch(0.95 0.008 260)',
    textSecondary: 'oklch(0.80 0.012 260)',
    textMuted: 'oklch(0.63 0.014 260)',    // 0.58 measured 4.18:1 and failed AA; do not lower

    // --- data roles ---
    //
    // THE WARM HALF IS RESERVED. The Amber Law used to protect a single swatch, and it was not
    // enough: the ambient field was tinted across the whole hue wheel, so amber had reds, oranges
    // and yellows sitting behind it and the chosen token stopped being the only warm thing on
    // screen. Now the split is structural -- the vocabulary at rest owns the COOL arc (185-295)
    // and may never leave it, and everything warm belongs to the live decision. That is why the
    // chosen token reads instantly against 151,665 others: nothing else in the room is warm.
    chosen: 'oklch(0.88 0.180 88)',        // the emitted token and nothing else
    trail: 'oklch(0.83 0.170 80)',         // the route through tokens already emitted; chosen's own past
    trailPast: 'oklch(0.55 0.140 62)',     // the oldest retained end of that same route
    candidate: 'oklch(0.93 0.025 230)',    // considered but not picked: bright, deliberately colourless
    attention: 'oklch(0.76 0.195 335)',    // links back to weighted earlier positions
    field: 'oklch(0.45 0.030 265)',        // the vocabulary at rest: ambient texture, not information
    template: 'oklch(0.40 0.010 265)',     // context the chat template added, never typed by the visitor
  },

  /**
   * The field's hue arc, in one place because two rules depend on it not moving.
   *
   * COOL ONLY. The arc runs teal -> blue -> indigo and stops short of magenta, which leaves the
   * whole warm half of the wheel to the live layer and keeps `attention` (335) clear of the end
   * of the ramp. Chroma is low because this is scenery: it may have structure without competing
   * with the adaptive candidate nucleus in front of it.
   */
  // Chroma is higher than a swatch would suggest and the light band is capped below 0.6. Both
  // are corrections for the same measured effect: these are 2-pixel dots at half opacity on a
  // near-black ground, and at low chroma the indigo end of the arc dilutes to plain grey, so the
  // upper half of the atlas washed out to white. Authored for how it lands, not how it reads.
  //
  // `levels` is an ELEVATION ramp, not two arbitrary bands. See VocabField for why.
  fieldArc: { start: 176, span: 128, chroma: 0.155, levels: [0.46, 0.53, 0.60, 0.67, 0.74] },

  font: {
    ui: '"IBM Plex Sans", system-ui, sans-serif',
    data: '"IBM Plex Mono", ui-monospace, monospace',
    // Token text is Chinese, Cyrillic, and sub-word fragments as often as it is English.
    // Native script faces sit ahead of the generic fallback so CJK tokens land in a deliberate
    // system family without adding a multi-megabyte webfont to the atlas payload.
    token: '"IBM Plex Mono", "IBM Plex Sans", "PingFang SC", "Hiragino Sans", "Yu Gothic UI", "Microsoft YaHei", ui-monospace, monospace',
  },

  space: { xs: '4px', sm: '8px', md: '14px', lg: '22px', xl: '34px' },
  radius: { sm: '4px', md: '8px', lg: '12px' },
}

/**
 * Scene defaults. Not colours -- these are the camera and atmosphere of the room.
 *
 * Tuned against the real distribution rather than guessed: the projection puts 57% of tokens
 * inside radius 20 and 99.5% inside radius 60. That dense core is why point size and opacity are
 * both low -- at higher values the additive blending saturates the middle to flat white and the
 * structure disappears, and the field stops being the ambient texture it is supposed to be.
 */
export const scene = {
  // Thinner than it was. Once `spread` pushes the core outward the atlas occupies far more depth,
  // and the old density fogged the whole far half of it into the void.
  fogDensity: 0.0022,     // exponential; the far edge of the vocabulary dissolves rather than ending
  cameraStart: [0, 10, 210],
  // Bigger and more solid than before. The old 2.0px flat dot read as dust; with the atlas
  // de-clumped there is room for dots large enough to look like objects. Each is multiplied by a
  // per-token factor -- see fieldMaterial.js -- so this is the size of an average token.
  fieldPointSize: 3.8,    // PIXELS, not world units -- size attenuation is off so zoom separates
  fieldOpacity: 0.80,     // a fade toward the void, NOT alpha: field dots stay opaque and occlude
  // Radial de-clumping. 0 is the raw projection; see lib/atlasSpace.js for what the transform
  // preserves and what it trades. Default is high because the raw distribution -- 57% of the
  // vocabulary inside 1% of the volume -- simply cannot be read whole.
  spread: 0.62,
  minDistance: 1.5,       // fly right inside the core
}

const cssName = (key) => `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`

/** Publish the token values as CSS custom properties so the chrome and the scene never drift. */
export function applyTokens(t = theme) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(t.color)) root.style.setProperty(cssName(key), value)
  for (const [key, value] of Object.entries(t.font)) root.style.setProperty(`--font-${key}`, value)
  for (const [key, value] of Object.entries(t.space)) root.style.setProperty(`--space-${key}`, value)
  for (const [key, value] of Object.entries(t.radius)) root.style.setProperty(`--radius-${key}`, value)
}
