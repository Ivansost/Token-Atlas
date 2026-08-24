import { Line } from '@react-three/drei'
import { useMemo } from 'react'

import { toHex, toRGB } from '../design/color'
import { theme } from '../design/tokens'
import { DiscPoints } from './DiscPoints'

/**
 * One decision, drawn: what the model considered, what it picked, what it looked at.
 *
 * This is the layer the whole project exists for, and it is the only thing in the scene allowed
 * to use colour. The field behind it stays grey precisely so these forty objects can own the eye.
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

export function LiveLayer({ step, selectedId, hoveredId, onSelect, nucleus = 0.99 }) {
  const attentionColor = toHex(theme.color.attention)

  const cloud = useMemo(() => {
    const positioned = step?.candidates.filter((c) => c.pos3d) ?? []
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
    const tints = new Float32Array(positioned.length * 3)
    const alphas = new Float32Array(positioned.length)

    positioned.forEach((candidate, i) => {
      const isChosen = candidate.id === step.chosen.id
      const isSelected = candidate.id === selectedId || candidate.id === hoveredId
      const inNucleus = i < cutoff

      const rgb = isChosen ? chosenRGB : inNucleus ? candidateRGB : fieldRGB
      const base = inNucleus ? sizeFor(candidate.prob) : OUTSIDE_SIZE

      positions.set(candidate.pos3d, i * 3)
      sizes[i] = (base + (isChosen ? CHOSEN_BONUS : 0)) * (isSelected ? 1.6 : 1)
      tints.set(rgb, i * 3)
      alphas[i] = isChosen ? 1 : inNucleus ? 0.45 + 0.5 * Math.sqrt(candidate.prob) : 0.28
    })

    return { positions, sizes, tints, alphas, items: positioned, cutoff }
  }, [step, selectedId, hoveredId, nucleus])

  const links = useMemo(() => {
    const from = step?.chosen?.pos3d
    if (!from) return []
    return step.attention.filter((a) => a.pos3d).map((a) => ({ ...a, points: [from, a.pos3d] }))
  }, [step])

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
          lineWidth={0.6 + 3.2 * (link.weight / maxWeight)}
          transparent
          opacity={0.22 + 0.6 * (link.weight / maxWeight)}
          depthWrite={false}
        />
      ))}

      <DiscPoints
        positions={cloud.positions}
        sizes={cloud.sizes}
        tints={cloud.tints}
        alphas={cloud.alphas}
      />

      {/*
        Hit targets. The discs are drawn at a constant PIXEL size, which a world-space raycast
        cannot reason about, so picking rides on invisible spheres sized in world units. They are
        deliberately generous -- clicking a 2-pixel dot is not an interaction, it is a test.
      */}
      {cloud.items.map((candidate) => (
        <mesh
          key={candidate.id}
          position={candidate.pos3d}
          onClick={(event) => {
            event.stopPropagation()
            onSelect?.({ ...candidate, source: 'candidate', chosen: candidate.id === step.chosen.id })
          }}
          onPointerOver={() => { document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { document.body.style.cursor = '' }}
        >
          <sphereGeometry args={[0.7 + 1.4 * Math.sqrt(candidate.prob), 8, 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
