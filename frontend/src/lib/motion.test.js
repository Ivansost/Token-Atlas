import assert from 'node:assert/strict'
import test from 'node:test'

import { dampingAmount } from './motion.js'

function remainingAfter(seconds, framesPerSecond) {
  let remaining = 1
  for (let frame = 0; frame < seconds * framesPerSecond; frame += 1) {
    remaining *= 1 - dampingAmount(1 / framesPerSecond)
  }
  return remaining
}

test('camera following covers the same distance at different refresh rates', () => {
  assert.ok(Math.abs(remainingAfter(1, 30) - remainingAfter(1, 60)) < 1e-12)
  assert.ok(Math.abs(remainingAfter(1, 60) - remainingAfter(1, 120)) < 1e-12)
})

test('invalid or paused frame deltas do not move the camera', () => {
  assert.equal(dampingAmount(0), 0)
  assert.equal(dampingAmount(Number.NaN), 0)
})
