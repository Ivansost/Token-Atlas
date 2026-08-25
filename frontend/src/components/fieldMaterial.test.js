import assert from 'node:assert/strict'
import test from 'node:test'

import { sizesFromIds } from './fieldMaterial.js'

test('token-id sizing is deterministic, bounded, and decreases with later ids', () => {
  const ids = new Uint32Array([0, 256, 10_000, 151_664])
  const sizes = sizesFromIds(ids, ids.length, 151_665)
  assert.equal(sizes.length, ids.length)
  assert.ok(sizes[0] > sizes[1])
  assert.ok(sizes[1] > sizes[2])
  assert.ok(sizes[2] > sizes[3])
  assert.ok(sizes[0] <= 1.75)
  assert.ok(sizes[3] >= 0.85)
})
