import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { toHex } from '../design/color'
import { theme } from '../design/tokens'

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
 * It is deliberately dim. It is ambient texture, not information to read, so it sits below the
 * contrast floor and gets out of the way of the live layer. The opacity is user-controlled.
 */
/**
 * A soft round mote, generated once at runtime.
 *
 * A default WebGL point is a hard square, which at this density reads as pixelation rather than
 * as dust in a projector beam. A radial alpha falloff costs one 64px texture and is the
 * difference between "particle field" and "screen artifact".
 */
function makeMoteTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function VocabField({ positions, count, opacity = 0.3, size = 0.85 }) {
  const materialRef = useRef()
  const mote = useMemo(makeMoteTexture, [])

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
        map={mote}
        alphaMap={mote}
        size={size}
        sizeAttenuation
        transparent
        opacity={opacity}
        // Additive blending is what turns a flat dust cloud into readable structure: where many
        // tokens occupy one region their light sums, so brightness IS density. That is real
        // information, not a glow effect.
        blending={THREE.AdditiveBlending}
        // 151k transparent points sorted against each other would thrash the depth buffer for no
        // visual gain, and additive blending is order-independent anyway.
        depthWrite={false}
        fog
      />
    </points>
  )
}
