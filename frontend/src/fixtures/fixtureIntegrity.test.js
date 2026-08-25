import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const events = JSON.parse(readFileSync(new URL('./steps.sample.json', import.meta.url), 'utf8'))
const steps = events.filter((event) => event.type === 'step')

test('the fallback recording follows the live event contract', () => {
  assert.ok(steps.length > 0)
  for (const step of steps) {
    assert.equal(step.candidates.length, 200)
    assert.ok(step.candidates.every((candidate) => candidate.prob > 0))
    for (let i = 1; i < step.candidates.length; i += 1) {
      assert.ok(step.candidates[i - 1].prob >= step.candidates[i].prob)
    }
    const attentionMass = step.attention_row.reduce((sum, weight) => sum + weight, 0)
    // The model computes attention in bfloat16; the averaged row is numerically close to, rather
    // than bit-exactly, one after it is converted for the wire.
    assert.ok(Math.abs(attentionMass - 1) < 0.002)
  }
})
