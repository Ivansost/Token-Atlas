import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { toHex } from '../design/color'
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
export function VocabField({ positions, count, opacity = 0.55, size = 2.4 }) {
  const materialRef = useRef()
  const disc = useMemo(makeDiscTexture, [])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    // The projection is centred on its median already; a sphere spares Three.js the bounding
    // pass over 151k points on every frustum check.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 120)
    return geo
  }, [positions])

  if (!positions || count === 0) return null

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={materialRef}
        color={toHex(theme.color.field)}
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
