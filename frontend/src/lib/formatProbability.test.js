import assert from 'node:assert/strict'
import test from 'node:test'

import { formatProbability, formatProbabilityDetail } from './formatProbability.js'

test('ordinary probabilities retain fixed-width tabular formatting', () => {
  assert.equal(formatProbability(0.731652, 4), '0.7317')
  assert.equal(formatProbability(0.000096, 4), '0.0001')
})

test('positive long-tail probabilities never display as zero', () => {
  assert.equal(formatProbability(0.00004, 4), '4.00e-5')
  assert.equal(formatProbability(4.9e-7, 6), '4.90e-7')
  assert.equal(formatProbability(0, 6), '0')
})

test('invalid probability values have an explicit fallback', () => {
  assert.equal(formatProbability(Number.NaN), '—')
  assert.equal(formatProbability(-0.2), '—')
})

test('detail formatting preserves inspectable long-tail precision', () => {
  assert.equal(formatProbabilityDetail(0.73165178), '0.73165178')
  assert.equal(formatProbabilityDetail(8.85e-7), '8.850000e-7')
})
