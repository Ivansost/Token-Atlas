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
    chosen: 'oklch(0.80 0.140 70)',        // THE AMBER LAW: the emitted token and nothing else
    candidate: 'oklch(0.86 0.020 250)',    // considered but not picked
    attention: 'oklch(0.70 0.140 300)',    // links back to weighted earlier positions
    field: 'oklch(0.45 0.030 265)',        // the vocabulary at rest: ambient texture, not information
    template: 'oklch(0.40 0.010 265)',     // context the chat template added, never typed by the visitor
  },

  font: {
    ui: '"IBM Plex Sans", system-ui, sans-serif',
    data: '"IBM Plex Mono", ui-monospace, monospace',
    // Token text is Chinese, Cyrillic, and sub-word fragments as often as it is English.
    // The CJK siblings sit ahead of the generic fallback so a token never drops to a
    // mismatched system face in the middle of a ranked list.
    token: '"IBM Plex Mono", "IBM Plex Sans JP", "Noto Sans SC", ui-monospace, monospace',
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
  fogDensity: 0.0036,     // exponential; the far edge of the vocabulary dissolves rather than ending
  cameraStart: [0, 6, 118],
  fieldPointSize: 2.4,    // PIXELS, not world units -- size attenuation is off so zoom separates
  fieldOpacity: 0.55,     // user-controllable; the field must recede behind the live layer
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
