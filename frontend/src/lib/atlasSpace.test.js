import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAtlasSpace, expandField, makeProjector } from './atlasSpace.js'

const positions = new Float32Array([
  1, 0, 0,
  0, 2, 0,
  0, 0, 4,
  -8, 0, 0,
])

test('zero spread returns the untouched coordinate objects', () => {
  const space = buildAtlasSpace(positions, 4)
  assert.equal(expandField(positions, 4, space, 0), positions)
  const point = [1, 2, 3]
  assert.equal(makeProjector(space, 0)(point), point)
})

test('spread preserves direction and radial ordering', () => {
  const space = buildAtlasSpace(positions, 4)
  const expanded = expandField(positions, 4, space, 0.75)
  const radii = []
  for (let i = 0; i < 4; i += 1) {
    const source = positions.slice(i * 3, i * 3 + 3)
    const target = expanded.slice(i * 3, i * 3 + 3)
    const sourceRadius = Math.hypot(...source)
    const targetRadius = Math.hypot(...target)
    radii.push(targetRadius)
    const crossMagnitude = Math.hypot(
      source[1] * target[2] - source[2] * target[1],
      source[2] * target[0] - source[0] * target[2],
      source[0] * target[1] - source[1] * target[0],
    )
    assert.ok(crossMagnitude / (sourceRadius * targetRadius) < 1e-6)
  }
  assert.deepEqual([...radii].sort((a, b) => a - b), radii)
})
