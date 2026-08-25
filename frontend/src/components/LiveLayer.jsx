import { Line } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

import { toHex, toRGB } from '../design/color'
import { theme } from '../design/tokens'
import { DiscPoints } from './DiscPoints'

/**
 * One decision, drawn: what the model considered, what it picked, what it looked at.
 *
 * This is the layer the whole project exists for, and it is the only thing in the scene allowed
 * to use warm colour. The cool field behind it recedes so this adaptive decision set owns the eye.
 *
 * Every position here is real. A candidate sits at its token's fixed coordinate, so `Paris`,
 * `London` and `巴黎` appear almost on top of each other -- within one unit in the projection --
 * while `The` sits 38 units away. The cloud's shape is the model's own geometry, not a layout.
 */

// Candidates are HIGHLIGHTED, not inflated.
//
// The first version scaled the winner to ~32px against a 2.4px field, which made it a boulder
// sitting in dust rather than a token the model picked -- and apparent size started reading as
// importance-in-general instead of probability. These sizes sit just above the field so the
// live layer reads as the same kind of object, lit up. Colour and brightness do the work that
// bulk was doing.
//
// Probability still drives diameter, on a SQUARE ROOT scale: it spans three orders of magnitude
// within one step (0.73 down to 0.000004), and on a linear scale the tail would vanish entirely
// so a step would look like a single choice rather than a distribution.
const sizeFor = (prob) => 3 + 8 * Math.sqrt(prob)
const CHOSEN_BONUS = 4
// Candidates outside the nucleus sit barely above the field: present, because the model did give
// them probability, but not claimed as part of the decision.
const OUTSIDE_SIZE = 2.8

// A dot may be only a few CSS pixels wide on a high-density display. Its hit target is deliberately
// larger, but still tight enough that nearby candidates resolve to whichever centre is closest.
const MIN_PICK_RADIUS = 8
const PICK_PADDING = 4
const MAX_CLICK_DRIFT = 2

export function LiveLayer({ step, selectedId, hoveredId, onSelect, nucleus = 0.99, project = (p) => p }) {
  const attentionColor = toHex(theme.color.attention)
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  const cloud = useMemo(() => {
    // Every drawn coordinate goes through the same spread transform as the field. If the live
    // layer skipped it, a candidate would render where its token used to be and the two layers
    // would silently disagree -- the worst possible failure in a scene whose claim is that
    // position means something.
    const positioned = (step?.candidates.filter((c) => c.pos3d) ?? [])
      .map((c) => ({ ...c, at: project(c.pos3d) }))
    if (positioned.length === 0) return null

    // THE NUCLEUS: the smallest set of candidates whose probabilities sum to the threshold.
    //
    // A fixed count is the wrong unit. Measured on a real run, the model needed 11 candidates to
    // reach 99% when choosing "Paris", and exactly ONE for "capital", "France" and the stop token
    // -- it was not deciding there, it was completing. Lighting the same 200 nodes at every step
    // would show deliberation that did not happen.
    //
    // So the highlight is adaptive: everything below the cutoff still renders, faintly, because
    // the model really did assign it something -- but only the nucleus is lit. How many nodes
    // light up becomes the reading: a wide constellation is a genuine decision, a single amber
    // point is a foregone conclusion. Same idea as nucleus sampling, applied to display rather
    // than to selection.
    let mass = 0
    let cutoff = positioned.length
    for (let i = 0; i < positioned.length; i += 1) {
      mass += positioned[i].prob
      if (mass >= nucleus) { cutoff = i + 1; break }
    }

    const chosenRGB = toRGB(theme.color.chosen)
    const candidateRGB = toRGB(theme.color.candidate)
    const fieldRGB = toRGB(theme.color.field)

    const positions = new Float32Array(positioned.length * 3)
    const sizes = new Float32Array(positioned.length)
    const halos = new Float32Array(positioned.length)
    const haloAlphas = new Float32Array(positioned.length)
    const tints = new Float32Array(positioned.length * 3)
    const alphas = new Float32Array(positioned.length)

    positioned.forEach((candidate, i) => {
      const isChosen = candidate.id === step.chosen.id
      const isSelected = candidate.id === selectedId || candidate.id === hoveredId
      const inNucleus = i < cutoff

      const rgb = isChosen ? chosenRGB : inNucleus ? candidateRGB : fieldRGB
      const base = inNucleus ? sizeFor(candidate.prob) : OUTSIDE_SIZE

      positions.set(candidate.at, i * 3)
      sizes[i] = (base + (isChosen ? CHOSEN_BONUS : 0)) * (isSelected ? 1.6 : 1)
      tints.set(rgb, i * 3)
      alphas[i] = isChosen ? 1 : inNucleus ? 0.45 + 0.5 * Math.sqrt(candidate.prob) : 0.28

      // The halo scales with confidence, so a token the model was sure of glows harder. Outside
      // the nucleus there is no halo at all -- those tokens were barely considered.
      //
      // The chosen token's halo is TIGHTER and BRIGHTER than it was. A wide faint one spread its
      // light over enough field dots that it read as a slightly brighter patch of crowd instead
      // of as a marker; concentrating the same light into a smaller radius gives it an edge. The
      // marker proper is the ring below -- this is only the glow under it.
      halos[i] = inNucleus ? sizes[i] * (isChosen ? 2.4 : 3.2) : 0
      haloAlphas[i] = inNucleus ? (isChosen ? 0.42 : 0.07 * Math.sqrt(candidate.prob)) : 0
    })

    const pack = (indices) => {
      const packedPositions = new Float32Array(indices.length * 3)
      const packedSizes = new Float32Array(indices.length)
      const packedHalos = new Float32Array(indices.length)
      const packedHaloAlphas = new Float32Array(indices.length)
      const packedTints = new Float32Array(indices.length * 3)
      const packedAlphas = new Float32Array(indices.length)
      indices.forEach((source, target) => {
        packedPositions.set(positions.subarray(source * 3, source * 3 + 3), target * 3)
        packedSizes[target] = sizes[source]
        packedHalos[target] = halos[source]
        packedHaloAlphas[target] = haloAlphas[source]
        packedTints.set(tints.subarray(source * 3, source * 3 + 3), target * 3)
        packedAlphas[target] = alphas[source]
      })
      return {
        positions: packedPositions,
        sizes: packedSizes,
        halos: packedHalos,
        haloAlphas: packedHaloAlphas,
        tints: packedTints,
        alphas: packedAlphas,
      }
    }

    const foreground = []
    const background = []
    positioned.forEach((candidate, i) => {
      if (i < cutoff || candidate.id === step.chosen.id) foreground.push(i)
      else background.push(i)
    })

    return {
      positions,
      sizes,
      items: positioned,
      foreground: pack(foreground),
      background: pack(background),
    }
  }, [step, selectedId, hoveredId, nucleus, project])

  const links = useMemo(() => {
    const from = step?.chosen?.pos3d
    if (!from) return []
    const origin = project(from)
    return step.attention
      .filter((a) => a.pos3d)
      .map((a) => ({ ...a, points: [origin, project(a.pos3d)] }))
  }, [step, project])

  // THE RETICLE. One ring, on the token the model just emitted, in the loudest amber the palette
  // has. Two concentric rings rather than one so it reads as an instrument mark and not as a
  // stray circle, and drawn as a RING because the field is made of filled dots -- a hollow shape
  // is the one thing 151,665 discs cannot accidentally imitate.
  const reticle = useMemo(() => {
    const at = step?.chosen?.pos3d && project(step.chosen.pos3d)
    if (!at) return null
    const rgb = toRGB(theme.color.chosen)
    const RINGS = [{ size: 26, alpha: 0.95 }, { size: 44, alpha: 0.4 }]
    const positions = new Float32Array(RINGS.length * 3)
    const sizes = new Float32Array(RINGS.length)
    const tints = new Float32Array(RINGS.length * 3)
    const alphas = new Float32Array(RINGS.length)
    RINGS.forEach((r, i) => {
      positions.set(at, i * 3)
      sizes[i] = r.size
      tints.set(rgb, i * 3)
      alphas[i] = r.alpha
    })
    return { positions, sizes, tints, alphas }
  }, [step, project])

  useEffect(() => {
    if (!cloud || !step || !onSelect) return undefined

    const canvas = gl.domElement
    const projected = new THREE.Vector3()
    let pointerDown = null

    const handlePointerDown = (event) => {
      if (event.button !== 0) return
      pointerDown = { x: event.clientX, y: event.clientY }
    }

    const handleClick = (event) => {
      // OrbitControls also begins on pointer-down. A drag that happens to end over a candidate is
      // navigation, not selection, so match React Three Fiber's two-pixel click tolerance.
      if (pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > MAX_CLICK_DRIFT) {
        pointerDown = null
        return
      }
      pointerDown = null

      const bounds = canvas.getBoundingClientRect()
      if (bounds.width === 0 || bounds.height === 0) return

      // `gl_PointSize` is measured in framebuffer pixels while pointer coordinates and the canvas
      // rectangle are CSS pixels. Deriving the scale from the backing buffer keeps picking honest
      // on both ordinary and Retina displays.
      const framebufferScale = canvas.width / bounds.width || 1
      let nearest = null
      let nearestDistanceSq = Infinity

      camera.updateMatrixWorld()

      for (let i = 0; i < cloud.items.length; i += 1) {
        projected.fromArray(cloud.positions, i * 3).project(camera)

        // Ignore points behind the camera or outside its near/far clipping planes.
        if (!Number.isFinite(projected.x) || projected.z < -1 || projected.z > 1) continue

        const x = bounds.left + ((projected.x + 1) * bounds.width) / 2
        const y = bounds.top + ((1 - projected.y) * bounds.height) / 2
        const dx = event.clientX - x
        const dy = event.clientY - y
        const distanceSq = dx * dx + dy * dy
        const visibleRadius = cloud.sizes[i] / (2 * framebufferScale)
        const pickRadius = Math.max(MIN_PICK_RADIUS, visibleRadius + PICK_PADDING)

        if (distanceSq <= pickRadius * pickRadius && distanceSq < nearestDistanceSq) {
          nearest = cloud.items[i]
          nearestDistanceSq = distanceSq
        }
      }

      if (!nearest) return

      // Candidate points sit over the vocabulary field. Once one wins the screen-space test, do
      // not let the scene's world-space raycaster select the field point behind it or clear the
      // selection as a miss.
      event.stopPropagation()
      event.stopImmediatePropagation()
      onSelect({ ...nearest, source: 'candidate', chosen: nearest.id === step.chosen.id })
    }

    // React Three Fiber listens on the canvas wrapper. Capturing on the canvas lets candidate
    // picking take precedence only when a candidate was actually hit; every other click continues
    // to the existing field picker and onPointerMissed path unchanged.
    canvas.addEventListener('pointerdown', handlePointerDown, true)
    canvas.addEventListener('click', handleClick, true)

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown, true)
      canvas.removeEventListener('click', handleClick, true)
    }
  }, [camera, cloud, gl, onSelect, step])

  if (!step || !cloud) return null

  const maxWeight = links.reduce((max, link) => Math.max(max, link.weight), 0) || 1

  return (
    <group>
      {links.map((link) => (
        <Line
          key={`att-${link.pos}`}
          points={link.points}
          color={attentionColor}
          // Weight is carried by thickness AND opacity, never by colour alone, so the ranking
          // survives greyscale and colour blindness.
          // Floors raised on both channels. The weakest of the five used to be drawn at 0.6px and
          // 22% opacity against a near-black ground, which is indistinguishable from not drawing
          // it -- so a step looked like it had two attention targets when it had five.
          lineWidth={1.6 + 3.4 * (link.weight / maxWeight)}
          transparent
          opacity={0.5 + 0.5 * (link.weight / maxWeight)}
          depthWrite={false}
          depthTest={false}
          renderOrder={10}
        />
      ))}

      {/*
        HALO, drawn first so the crisp disc sits on top of it.

        This is glow built from geometry rather than from a post-processing pass. The obvious
        approach -- EffectComposer + Bloom -- renders a completely black frame on postprocessing
        3.1 with React Three Fiber 9, which is not a subtle bug: the canvas mounts, the data
        loads, and nothing is drawn at all. A wide, faint, additively-blended copy of the same
        points gives the lit layer presence with no compositor involved and nothing to break.
      */}
      {cloud.background.sizes.length > 0 && (
        <DiscPoints
          positions={cloud.background.positions}
          sizes={cloud.background.sizes}
          tints={cloud.background.tints}
          alphas={cloud.background.alphas}
        />
      )}

      <DiscPoints
        positions={cloud.foreground.positions}
        sizes={cloud.foreground.halos}
        tints={cloud.foreground.tints}
        alphas={cloud.foreground.haloAlphas}
        additive
        depthTest={false}
        renderOrder={7}
      />

      <DiscPoints
        positions={cloud.foreground.positions}
        sizes={cloud.foreground.sizes}
        tints={cloud.foreground.tints}
        alphas={cloud.foreground.alphas}
        depthTest={false}
        renderOrder={8}
      />

      {reticle && (
        <DiscPoints
          positions={reticle.positions}
          sizes={reticle.sizes}
          tints={reticle.tints}
          alphas={reticle.alphas}
          ring
          depthTest={false}
          renderOrder={12}
        />
      )}
    </group>
  )
}
