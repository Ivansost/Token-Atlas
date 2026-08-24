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
 *
 * ── Why the ageing ramp does not fade to the background ──────────────────────────────────────
 *
 * The first version aged the trail by interpolating its colour toward the field's own grey-blue,
 * on the theory that the path should dissolve into the vocabulary rather than stop abruptly. In
 * practice the older two-thirds of the line simply vanished: it was a thin, half-transparent
 * stroke being tinted toward the exact colour of everything behind it. The route the model walked
 * is the second most important thing in this scene and it was invisible.
 *
 * So the ramp now stays inside the WARM family end to end -- deep bronze at the tail, hot yellow
 * at the head. Age is still legible, because bronze and yellow are obviously different; but every
 * point on the ramp is warm, and the field is now confined to the cool arc, so no part of the
 * trail can ever match its surroundings. Fade to a colour that is not in the room, not to one
 * that is.
 */

// Older than this and it goes. A 120-token answer would otherwise leave a line long enough to
// obscure the room it is drawn in -- and now that the line is opaque, that matters more.
const MAX_TRAIL = 18

export function Trail({ steps, index, maxTrail = MAX_TRAIL, project = (p) => p }) {
  const { points, colors, marks } = useMemo(() => {
    const walked = steps
      .slice(0, index + 1)
      .map((step) => step.chosen)
      .filter((chosen) => chosen?.pos3d)
      .map((chosen) => ({ ...chosen, at: project(chosen.pos3d) }))

    if (walked.length < 2) return { points: [], colors: [], marks: null }

    const recent = walked.slice(Math.max(0, walked.length - maxTrail))

    // Both ends warm. `tail` is a deep bronze -- unmistakably the same family as the head, and
    // unmistakably not the field.
    const head = toRGB(theme.color.chosen)
    const tail = toRGB('oklch(0.55 0.140 62)')
    const ramp = (age) => head.map((channel, c) => tail[c] + (channel - tail[c]) * age)

    // A dot at each waypoint, so individual decisions stay countable along the route.
    const positions = new Float32Array(recent.length * 3)
    const sizes = new Float32Array(recent.length)
    const tints = new Float32Array(recent.length * 3)
    const alphas = new Float32Array(recent.length)

    recent.forEach((chosen, i) => {
      const age = i / Math.max(recent.length - 1, 1)
      positions.set(chosen.at, i * 3)
      sizes[i] = 3.5 + 4 * age
      tints.set(ramp(age), i * 3)
      // Alpha carries age too, but its floor is high: the oldest waypoint is still solidly there.
      alphas[i] = 0.45 + 0.55 * age
    })

    // CURVED, not straight. Consecutive words are not semantically adjacent -- 'Paris' then 'is'
    // then 'the' land in completely different regions -- so joining them with straight segments
    // draws a harsh zigzag that reads as scribble rather than as a route. A smooth spline through
    // the same waypoints reads as travel, which is what it is. The waypoints are untouched: only
    // the line between them is interpolated, and the dots mark where the real decisions sit.
    const waypoints = recent.map((chosen) => new THREE.Vector3(...chosen.at))
    const curve = new THREE.CatmullRomCurve3(waypoints, false, 'catmullrom', 0.4)
    const smooth = curve.getPoints(Math.max(waypoints.length - 1, 1) * 12)

    return {
      points: smooth.map((v) => [v.x, v.y, v.z]),
      colors: smooth.map((_, i) => ramp(i / Math.max(smooth.length - 1, 1))),
      marks: { positions, sizes, tints, alphas },
    }
  }, [steps, index, maxTrail, project])

  if (points.length < 2) return null

  return (
    <group>
      {/*
        Two strokes, not one. The wide additive pass is the trail's glow -- it is what makes the
        route visible from across the atlas and reads as light rather than as a fat line. The thin
        opaque pass on top is the route itself, and it keeps its hard edge no matter how much glow
        is stacked behind it. Same trick as the halo pass in the live layer, and the same reason:
        real bloom renders a black frame on this stack.
      */}
      <Line
        points={points}
        vertexColors={colors}
        lineWidth={5.5}
        transparent
        opacity={0.13}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
      <Line
        points={points}
        vertexColors={colors}
        lineWidth={2.4}
        transparent
        opacity={0.95}
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
