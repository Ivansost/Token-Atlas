import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

import { toRGB } from '../design/color'
import { theme } from '../design/tokens'
import { DiscPoints } from './DiscPoints'

/**
 * The path the answer took through the vocabulary.
 *
 * Every chosen token has a real position, so the sentence is literally a trajectory: `Paris` sits
 * in the cities region, `is` and `the` out among the function words, `capital` somewhere else
 * again. Joining them in order draws the route the model walked to build its answer.
 *
 * This is what the plan meant by deciding "what happens to previous steps' clouds" -- the question
 * it called the one that determines whether the scene reads as a story or as a mess. Until now
 * each step simply replaced the last, so the scene had no memory and no motion: it was a slideshow
 * of unrelated dot fields. A visible path gives the run a shape you can watch accumulate.
 *
 * Nothing here is invented. Every vertex is a token the model actually emitted, at the coordinate
 * it actually occupies. The line is the only thing added, and it means "then it chose this".
 */
export function Trail({ steps, index, maxTrail = 14 }) {
  const { points, colors, marks } = useMemo(() => {
    const walked = steps
      .slice(0, index + 1)
      .map((step) => step.chosen)
      .filter((chosen) => chosen?.pos3d)

    if (walked.length < 2) return { points: [], colors: [], marks: null }

    // Only the recent past stays drawn. A 120-token answer would otherwise leave a line long
    // enough to obscure the room it is drawn in.
    const recent = walked.slice(Math.max(0, walked.length - maxTrail))

    const chosenRGB = toRGB(theme.color.chosen)
    const fadeRGB = toRGB(theme.color.field)

    // Age is carried by colour, not just alpha: the oldest vertices sit at the field's own colour,
    // so the path dissolves into the vocabulary rather than stopping abruptly.
    const cols = recent.map((_, i) => {
      const age = i / Math.max(recent.length - 1, 1)
      return chosenRGB.map((channel, c) => fadeRGB[c] + (channel - fadeRGB[c]) * age)
    })

    // A dot at each waypoint, so individual decisions stay countable along the route.
    const positions = new Float32Array(recent.length * 3)
    const sizes = new Float32Array(recent.length)
    const tints = new Float32Array(recent.length * 3)
    const alphas = new Float32Array(recent.length)

    recent.forEach((chosen, i) => {
      const age = i / Math.max(recent.length - 1, 1)
      positions.set(chosen.pos3d, i * 3)
      sizes[i] = 2.5 + 3 * age
      tints.set(cols[i], i * 3)
      alphas[i] = 0.15 + 0.55 * age
    })

    // CURVED, not straight. Consecutive words are not semantically adjacent -- 'Paris' then 'is'
    // then 'the' land in completely different regions -- so joining them with straight segments
    // draws a harsh zigzag that reads as scribble rather than as a route. A smooth spline through
    // the same waypoints reads as travel, which is what it is. The waypoints are untouched: only
    // the line between them is interpolated, and the dots mark where the real decisions sit.
    const waypoints = recent.map((chosen) => new THREE.Vector3(...chosen.pos3d))
    const curve = new THREE.CatmullRomCurve3(waypoints, false, 'catmullrom', 0.4)
    const samplesPerLeg = 12
    const smooth = curve.getPoints(Math.max(waypoints.length - 1, 1) * samplesPerLeg)

    // Re-spread the age gradient across the denser sampled line.
    const smoothColors = smooth.map((_, i) => {
      const age = i / Math.max(smooth.length - 1, 1)
      return chosenRGB.map((channel, c) => fadeRGB[c] + (channel - fadeRGB[c]) * age)
    })

    return {
      points: smooth.map((v) => [v.x, v.y, v.z]),
      colors: smoothColors,
      marks: { positions, sizes, tints, alphas },
    }
  }, [steps, index, maxTrail])

  if (points.length < 2) return null

  return (
    <group>
      <Line
        points={points}
        vertexColors={colors}
        lineWidth={1.1}
        transparent
        opacity={0.55}
        depthWrite={false}
      />
      <DiscPoints
        positions={marks.positions}
        sizes={marks.sizes}
        tints={marks.tints}
        alphas={marks.alphas}
      />
    </group>
  )
}
