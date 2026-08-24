import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { toHex, toRGB } from '../design/color'
import { theme } from '../design/tokens'

/**
 * A crisp disc, generated once at runtime.
 *
 * A default WebGL point is a hard square, which reads as pixelation. The first attempt replaced
 * it with a soft radial gradient, which was worse: every token became a smudge and nothing looked
 * like a distinct object. This is a solid disc with a one-pixel antialiased edge -- a dot, not a
 * glow. Density comes from how many dots are there, never from how blurry each one is.
 */
function makeDiscTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.86, 'rgba(255,255,255,1)')   // solid to the edge
  gradient.addColorStop(1, 'rgba(255,255,255,0)')      // then a thin AA falloff
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  return texture
}

/**
 * The vocabulary field: every token the model knows, at its real position.
 *
 * 151,665 points in a SINGLE draw call. They are one BufferGeometry with one BufferAttribute
 * pointing straight at the Float32Array that came off the network -- no per-node objects, no
 * React elements per point. This is the reason the project moved off react-force-graph-3d,
 * which builds a scene object per node and would grind to a halt here.
 *
 * What it means: the whole thing is the model's own semantic space, projected to 3D. The regions
 * are real, because the coordinates come from the model's embeddings rather than from a layout
 * algorithm run for looks.
 *
 * MEASURED, not assumed: the space is organised by MEANING, not by script or token type. CJK
 * tokens spread at 0.98x the whole vocabulary's spread and Latin words at 1.03x -- i.e. they do
 * not cluster together at all. What clusters is sense: " dog" sits beside ·Dog, ·dogs, 犬, 小狗,
 * 狗 and ·canine, so the Chinese word for dog is near the English one rather than near other
 * Chinese words. Do not colour this field by script and call it structure.
 *
 * Why it exists at all: the visual reference is dense, and one generation step has only 40
 * candidates. Rather than fabricate points to fake density, the field supplies real ones.
 *
 * It is deliberately dim, and it is deliberately UNLINKED. Lines in this scene mean attention:
 * drawing the vocabulary's neighbour graph here was tried and reverted, because 400,000 links on
 * screen before the model has done anything spends the one visual language the live layer needs.
 * The field is ambient texture, not information to read.
 */
export function VocabField({ positions, raw, count, opacity = 0.55, size = 2.4, stride = 1, tint = 0.7, onSelect }) {
  const materialRef = useRef()
  const disc = useMemo(makeDiscTexture, [])

  // `stride` thins the field UNIFORMLY -- every nth token, never a filtered subset. A visitor
  // dialling it down sees a sparser sample of the same space with the same shape, rather than a
  // different vocabulary. `ids` keeps the mapping back to real token ids so a click can still say
  // what it hit.
  const { drawn, ids } = useMemo(() => {
    if (stride <= 1) return { drawn: positions, ids: null }
    const kept = Math.ceil(count / stride)
    const out = new Float32Array(kept * 3)
    const index = new Uint32Array(kept)
    for (let i = 0, j = 0; i < count; i += stride, j += 1) {
      out[j * 3] = positions[i * 3]
      out[j * 3 + 1] = positions[i * 3 + 1]
      out[j * 3 + 2] = positions[i * 3 + 2]
      index[j] = i
    }
    return { drawn: out, ids: index }
  }, [positions, count, stride])

  /**
   * COLOUR BY POSITION, ON A COOL ARC.
   *
   * Hue is a direct function of where a token sits: the angle it makes around the centre, mapped
   * onto the arc reserved for the field. Nothing is clustered and no category is invented --
   * neighbouring tokens simply get neighbouring hues, which is enough to make the regions the
   * projection already has visible. The honest sentence is "hue is location", and it is exactly
   * true.
   *
   * The arc is COOL and it is narrow, and that is the fix for the thing that was wrong here.
   * Spraying the field across all 360 degrees meant the vocabulary contained oranges and yellows,
   * so amber -- the one colour that is supposed to mean "the model chose this" -- had to compete
   * with scenery painted in its own family. Confining the field to teal-through-indigo gives the
   * live layer the entire warm half of the wheel to itself.
   *
   * Hues are quantised into buckets so the OKLCH conversion runs ~144 times rather than 151,665.
   */
  const colors = useMemo(() => {
    if (tint <= 0) return null

    const { start, span, chroma, levels } = theme.fieldArc
    const BUCKETS = 72

    // Lightness is ELEVATION, hue is AZIMUTH. Together they encode the token's full direction
    // from the centre of the atlas, not just its bearing -- which is the fix for the atlas
    // looking monochrome from any single viewpoint. With hue alone, a camera parked on one side
    // saw one arc of the wheel and the whole vocabulary read as teal; adding elevation means two
    // tokens on the same bearing but at different heights are told apart from every angle.
    //
    // Elevation is `y / r`, the sine of the angle above the equator, so it is scale-free and
    // survives the spread transform untouched.
    const palette = levels.map((lightness) =>
      Array.from({ length: BUCKETS }, (_, i) =>
        toRGB(`oklch(${lightness} ${(chroma * tint).toFixed(3)} ${(start + (i * span) / BUCKETS).toFixed(1)})`),
      ),
    )

    const base = toRGB(theme.color.field)
    const n = drawn.length / 3
    const out = new Float32Array(n * 3)

    for (let i = 0; i < n; i += 1) {
      const x = drawn[i * 3]
      const y = drawn[i * 3 + 1]
      const z = drawn[i * 3 + 2]
      const angle = Math.atan2(z, x) + Math.PI              // 0..2pi
      const bucket = Math.min(BUCKETS - 1, Math.floor((angle / (2 * Math.PI)) * BUCKETS))
      const r = Math.sqrt(x * x + y * y + z * z) || 1
      const elevation = (y / r + 1) / 2                     // 0 at the south pole, 1 at the north
      const level = Math.min(levels.length - 1, Math.floor(elevation * levels.length))
      const rgb = palette[level][bucket]
      // Blend toward the neutral field colour so `tint` genuinely fades to the old look at 0.
      out[i * 3] = base[0] + (rgb[0] - base[0]) * tint
      out[i * 3 + 1] = base[1] + (rgb[1] - base[1]) * tint
      out[i * 3 + 2] = base[2] + (rgb[2] - base[2]) * tint
    }
    return out
  }, [drawn, tint])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(drawn, 3))
    if (colors) geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    // The projection is centred on its median already; a sphere spares Three.js the bounding
    // pass over 151k points on every frustum check.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 400)
    return geo
  }, [drawn, colors])

  if (!positions || count === 0) return null

  return (
    <points
      geometry={geometry}
      frustumCulled={false}
      onClick={(event) => {
        event.stopPropagation()
        const drawnIndex = event.index
        if (drawnIndex == null) return
        // `event.index` indexes the DRAWN buffer, which is a subsample when stride > 1, so it has
        // to be mapped back to the real token id before it means anything.
        const id = ids ? ids[drawnIndex] : drawnIndex
        // RAW coordinates, deliberately. `drawn` has been through the spread transform, which is
        // a display choice; the number a visitor reads in the Selection panel has to be the one
        // the projection actually produced.
        const source = raw ?? drawn
        onSelect?.({
          id,
          source: 'field',
          pos3d: [source[id * 3], source[id * 3 + 1], source[id * 3 + 2]],
          drawnAt: [drawn[drawnIndex * 3], drawn[drawnIndex * 3 + 1], drawn[drawnIndex * 3 + 2]],
        })
      }}
    >
      <pointsMaterial
        ref={materialRef}
        color={colors ? 0xffffff : toHex(theme.color.field)}
        vertexColors={Boolean(colors)}
        map={disc}
        alphaMap={disc}
        size={size}
        // OFF, deliberately, and this is the single most important line in the file.
        //
        // With size attenuation on, points grow as the camera approaches, so flying into the
        // dense core scales the dots with you and it stays one solid blob at every zoom level --
        // you can never resolve individual tokens. Constant screen-space size means zooming
        // spreads the cloud apart while each dot stays the same few pixels, so a cluster
        // separates into its members. It is how a point-cloud atlas is meant to behave.
        //
        // Depth is still legible: fog does that job, and it does it without destroying
        // separability.
        sizeAttenuation={false}
        transparent
        opacity={opacity}
        // Discards the square corners so points are genuinely round rather than round-looking.
        alphaTest={0.28}
        // Normal blending, not additive. Additive sums overlapping dots toward white, which in a
        // core holding 57% of the vocabulary produces one flat saturated mass -- the opposite of
        // resolving individual tokens.
        blending={THREE.NormalBlending}
        depthWrite={false}
        fog
      />
    </points>
  )
}
