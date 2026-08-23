import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * Flat discs at a constant screen size, one per point, each with its own size and colour.
 *
 * WHY THIS EXISTS: the live layer used to be 3D spheres while the field was flat screen-space
 * dots, and that mismatch was most of what made the scene look wrong. The chosen token did not
 * read as "a bigger node", it read as a different kind of object -- a ball, lit differently,
 * scaling differently with distance, with field dots speckling across its front. Two visual
 * languages in one scene.
 *
 * Now both layers are the same thing: flat circles that hold their pixel size as you fly around.
 * The live layer differs only in what it is allowed to differ in -- size, colour, brightness.
 *
 * `THREE.PointsMaterial` cannot do per-point size, which is why this is a small shader rather
 * than a built-in material.
 */

const vertexShader = /* glsl */ `
  attribute float size;
  attribute vec3 tint;
  attribute float alpha;
  varying vec3 vTint;
  varying float vAlpha;

  void main() {
    vTint = tint;
    vAlpha = alpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // Pixels, not world units: the disc holds its size as the camera moves, so a cluster
    // separates when you zoom instead of scaling with you.
    gl_PointSize = size;
  }
`

const fragmentShader = /* glsl */ `
  varying vec3 vTint;
  varying float vAlpha;

  void main() {
    vec2 offset = gl_PointCoord - vec2(0.5);
    float r = length(offset);
    if (r > 0.5) discard;                        // a circle, not the default square
    float edge = smoothstep(0.5, 0.44, r);       // one-pixel antialiased rim, no glow
    gl_FragColor = vec4(vTint, vAlpha * edge);
  }
`

export function DiscPoints({ positions, sizes, tints, alphas, depthWrite = false }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('tint', new THREE.BufferAttribute(tints, 3))
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))
    geo.computeBoundingSphere()
    return geo
  }, [positions, sizes, tints, alphas])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite,
      }),
    [depthWrite],
  )

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
