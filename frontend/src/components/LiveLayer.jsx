import { Html, Line } from '@react-three/drei'
import { useMemo } from 'react'

import { toHex } from '../design/color'
import { theme } from '../design/tokens'

/**
 * One decision, drawn: what the model considered, what it picked, what it looked at.
 *
 * This is the layer the whole project exists for, and it is the only thing in the scene allowed
 * to use colour. The field behind it stays grey precisely so these forty objects can own the eye.
 *
 * Every position here is real. A candidate sits at its token's fixed coordinate, so `Paris`,
 * `London` and `巴黎` appear almost on top of each other -- they are within one unit in the
 * projection -- while `The` sits 38 units away. The cloud's shape is the model's own geometry,
 * not a layout.
 */

// Probability spans three orders of magnitude in a single step (0.73 down to 0.0002). Radius
// scales with the SQUARE ROOT so a 73% winner does not visually erase a 0.9% also-ran; on a
// linear scale the tail would be invisible dots and the step would look like a single choice
// rather than a distribution.
const radiusFor = (prob) => 0.55 + 2.3 * Math.sqrt(prob)

export function LiveLayer({ step, showLabels = true }) {
  const chosenColor = toHex(theme.color.chosen)
  const candidateColor = toHex(theme.color.candidate)
  const attentionColor = toHex(theme.color.attention)

  const { candidates, chosen, links } = useMemo(() => {
    if (!step) return { candidates: [], chosen: null, links: [] }

    const positioned = step.candidates.filter((c) => c.pos3d)
    const chosenRef = step.chosen.pos3d ? step.chosen : null

    // Attention is drawn FROM the token just chosen BACK to the earlier positions it weighted
    // most heavily. Direction matters: this is "what this position looked at", never "what caused
    // this word", and the arrow of the line is the only thing carrying that.
    const from = chosenRef?.pos3d
    const built = from
      ? step.attention
          .filter((a) => a.pos3d)
          .map((a) => ({ ...a, points: [from, a.pos3d] }))
      : []

    return { candidates: positioned, chosen: chosenRef, links: built }
  }, [step])

  if (!step) return null

  const maxWeight = links.reduce((max, link) => Math.max(max, link.weight), 0) || 1

  return (
    <group>
      {links.map((link) => (
        <Line
          key={`att-${link.pos}`}
          points={link.points}
          color={attentionColor}
          // Weight is carried by thickness AND opacity, never by colour alone, so the ranking
          // survives greyscale and colour-blindness.
          lineWidth={0.6 + 3.4 * (link.weight / maxWeight)}
          transparent
          opacity={0.25 + 0.6 * (link.weight / maxWeight)}
          depthWrite={false}
        />
      ))}

      {candidates.map((candidate) => {
        const isChosen = candidate.id === step.chosen.id
        return (
          <mesh key={candidate.id} position={candidate.pos3d}>
            <sphereGeometry args={[radiusFor(candidate.prob), 16, 12]} />
            <meshBasicMaterial
              color={isChosen ? chosenColor : candidateColor}
              transparent
              opacity={isChosen ? 1 : 0.45 + 0.5 * Math.sqrt(candidate.prob)}
              fog={false}
            />
          </mesh>
        )
      })}

      {showLabels && chosen && (
        <Html position={chosen.pos3d} center={false} distanceFactor={90} zIndexRange={[10, 0]}>
          <div style={labelStyle}>
            <span className="token">{chosen.text.replace(/ /g, '·')}</span>
            <span className="data" style={{ opacity: 0.75 }}>{chosen.prob.toFixed(4)}</span>
          </div>
        </Html>
      )}
    </group>
  )
}

// Labels float beside objects and never sit in a box -- no panel, no border, no backdrop.
const labelStyle = {
  transform: 'translate(26px, -50%)',
  display: 'flex',
  gap: '10px',
  alignItems: 'baseline',
  whiteSpace: 'nowrap',
  color: 'var(--chosen)',
  fontSize: '13px',
  letterSpacing: '0.02em',
  pointerEvents: 'none',
  userSelect: 'none',
}
