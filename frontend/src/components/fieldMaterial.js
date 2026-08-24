import * as THREE from 'three'

import { toRGB } from '../design/color'
import { theme } from '../design/tokens'

/**
 * The field's material: shaded sphere impostors, not flat specks.
 *
 * WHY THIS REPLACED `THREE.PointsMaterial`.
 *
 * The old field was a 2-pixel flat disc at half opacity, and it read as *spray* -- dust, haze,
 * a texture -- rather than as a hundred and fifty thousand individual things. Three separate
 * decisions were causing that, and none of them could be fixed from a built-in material:
 *
 *   1. FLAT. Every dot was one uniform colour, so it was a coloured pixel rather than an object.
 *      A sphere is legible because it is lit: bright where it faces the light, dark at the rim.
 *      This shader computes a hemisphere normal from the point's own coordinate and shades it,
 *      which costs one square root and turns each dot into something that looks like a ball.
 *
 *   2. TRANSPARENT. With `depthWrite` off, a near dot did not occlude a far one -- they summed
 *      into a wash instead. Solid dots that properly hide what is behind them are the single
 *      strongest cue that these are objects sitting in a space, and it is most of what makes a
 *      point cloud read as a graph. So opacity here is NOT alpha: `uOpacity` fades each dot's
 *      colour toward the void, which recedes exactly like transparency does but keeps every dot
 *      opaque and depth-correct. Only the one-pixel antialiased rim is genuinely blended.
 *
 *   3. UNIFORM. Every dot was the same size, and a field of identically-sized dots is noise --
 *      there is nothing for the eye to latch onto. Real node graphs vary node size, which is why
 *      they read as populations of distinct things.
 *
 * On (3), the size is REAL and not decoration. It comes from the token's own id, which in a BPE
 * vocabulary is merge order -- the tokenizer learned the most frequent pieces first. Verified
 * against this vocabulary: ids 256-269 are `in`, `er`, `on`, `re`, `at`, `st`, `en`, `or`, and
 * ids around 150,000 are lone Devanagari, Gujarati, Georgian and archaic Greek glyphs. So low id
 * really does mean common, the ramp is logarithmic because word frequency is roughly Zipfian,
 * and the honest sentence is "bigger means the tokenizer learned it earlier".
 */

const vertexShader = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;

  uniform float uSize;
  uniform float uFogDensity;

  varying vec3 vColor;
  varying float vFog;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;

    // Pixels, not world units. Size attenuation stays off for the reason it always has: with it
    // on, flying into the core scales the dots with you and the cluster never resolves.
    gl_PointSize = uSize * aSize;

    float f = uFogDensity * max(-mv.z, 0.0);
    vFog = 1.0 - exp(-f * f);          // exponential-squared, matching the scene fog
    vColor = aColor;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uVoid;
  uniform vec3 uFogColor;
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vFog;

  void main() {
    vec2 offset = gl_PointCoord - vec2(0.5);
    float r2 = dot(offset, offset) * 4.0;         // 0 at the centre, 1 at the rim
    if (r2 > 1.0) discard;                        // a circle, not the default square

    // The z of a unit hemisphere at this point: the impostor's surface normal. One sqrt buys the
    // difference between a flat disc and something that reads as a ball.
    float z = sqrt(max(1.0 - r2, 0.0));
    // gl_PointCoord grows downward, hence the negated y. Light sits above and to the left, in
    // front -- one fixed direction for the whole field, so shading reads as form and never as
    // information.
    vec3 normal = normalize(vec3(offset.x, -offset.y, z * 0.85));
    float lambert = clamp(dot(normal, normalize(vec3(-0.35, 0.45, 0.82))), 0.0, 1.0);
    // Floor raised deliberately. When the dots were translucent, overlapping ones summed and the
    // field got its brightness for free; opaque dots occlude instead, so only the near surface is
    // ever seen and the same shading maths came out much darker. The unlit side of a node must
    // stay clearly coloured rather than falling to near-black.
    float shade = 0.66 + 0.5 * lambert;

    // Opacity as a fade toward the void rather than as alpha -- see the note above.
    vec3 lit = mix(uVoid, vColor * shade, uOpacity);
    gl_FragColor = vec4(mix(lit, uFogColor, vFog), smoothstep(1.0, 0.86, r2));
  }
`

export function makeFieldMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uSize: { value: 3.8 },
      uOpacity: { value: 0.80 },
      uFogDensity: { value: 0.0022 },
      uVoid: { value: new THREE.Color(...toRGB(theme.color.void)) },
      uFogColor: { value: new THREE.Color(...toRGB(theme.color.voidDeep)) },
    },
    // Transparent for the antialiased rim only; the interior is opaque and writes depth, so dots
    // occlude each other properly instead of summing into a wash.
    transparent: true,
    depthWrite: true,
    depthTest: true,
  })
}

/**
 * Per-point size multiplier from token id, on a log ramp because frequency is roughly Zipfian.
 *
 * A linear ramp put almost the whole vocabulary at the small end and wasted the range on the few
 * hundred most common tokens. On a log ramp the sizes actually spread: id 0 lands near 1.75x, a
 * common word around 1.25x, an uncommon one 1.0x, and a rare glyph at the 0.85x floor.
 */
export function sizesFromIds(ids, drawnCount, vocabCount) {
  const out = new Float32Array(drawnCount)
  const denom = Math.log(1 + vocabCount)
  for (let i = 0; i < drawnCount; i += 1) {
    const id = ids ? ids[i] : i
    const commonness = 1 - Math.log(1 + id) / denom
    // Floor raised for the same reason as the shading: most of the vocabulary sits at the rare
    // end, so a low floor made most of the field tiny and the atlas looked emptier than it is.
    out[i] = 0.85 + 0.9 * commonness
  }
  return out
}
