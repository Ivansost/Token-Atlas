import { useEffect, useMemo } from 'react'
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

/**
 * RING variant: an annulus rather than a filled disc.
 *
 * This exists because of a specific failure. The chosen token was marked with a big soft halo,
 * and a big soft halo is the one shape that cannot survive this scene -- it is a blurry circle
 * drawn on top of a field made entirely of circles, so it read as slightly-brighter-crowd rather
 * than as a marker. A ring is a shape the vocabulary does not contain. Nothing else on screen is
 * hollow, so the reticle around the current token is unmistakable at any zoom, against any
 * density, and it stays legible even where the field is thickest.
 *
 * Thickness is in units of the point's own radius, so the ring keeps its proportions as it is
 * animated rather than turning into a filled dot when it shrinks.
 */
const ringFragmentShader = /* glsl */ `
  varying vec3 vTint;
  varying float vAlpha;

  void main() {
    vec2 offset = gl_PointCoord - vec2(0.5);
    float r = length(offset) * 2.0;              // 0 at the centre, 1 at the rim
    float band = 0.16;
    float ring = smoothstep(1.0, 1.0 - band, r) * smoothstep(1.0 - band * 2.0, 1.0 - band, r);
    if (ring < 0.01) discard;
    gl_FragColor = vec4(vTint, vAlpha * ring);
  }
`

export function DiscPoints({ positions, sizes, tints, alphas, depthWrite = false, additive = false, ring = false, depthTest = true, renderOrder = 0 }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('tint', new THREE.BufferAttribute(tints, 3))
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))
    geo.computeBoundingSphere()
    return geo
  }, [positions, sizes, tints, alphas])
  useEffect(() => () => geometry.dispose(), [geometry])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader: ring ? ringFragmentShader : fragmentShader,
        transparent: true,
        depthWrite,
        // Additive is used for the halo pass only, where overlapping light SHOULD sum. The dots
        // themselves stay on normal blending: additive there sums the dense core toward white and
        // destroys exactly the separability the constant point size exists to protect.
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        // Markers may opt out of depth testing. Now that the field writes depth, a token deep
        // inside the cloud is genuinely hidden by the tokens in front of it -- correct for data,
        // wrong for a marker whose entire job is to be findable. The reticle and the route are
        // annotations on the scene, not objects in it, so they draw over everything.
        depthTest,
      }),
    [depthWrite, additive, ring, depthTest],
  )
  useEffect(() => () => material.dispose(), [material])

  return <points geometry={geometry} material={material} renderOrder={renderOrder} frustumCulled={false} />
}
