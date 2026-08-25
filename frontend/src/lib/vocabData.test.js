import assert from 'node:assert/strict'
import test from 'node:test'

import { decodeCoordinateBuffer, validateTokenList } from './vocabData.js'

test('coordinate buffers decode as exact xyz float32 triples', () => {
  const source = new Float32Array([1.25, -2.5, 3.75, 4, 5, 6])
  const decoded = decodeCoordinateBuffer(source.buffer)
  assert.deepEqual([...decoded], [...source])
})

test('empty and partial coordinate buffers are rejected', () => {
  assert.throws(() => decodeCoordinateBuffer(new ArrayBuffer(0)), /xyz float32 triples/)
  assert.throws(() => decodeCoordinateBuffer(new ArrayBuffer(16)), /xyz float32 triples/)
})

test('token labels must be a non-empty string list', () => {
  assert.deepEqual(validateTokenList(['a', '犬']), ['a', '犬'])
  assert.throws(() => validateTokenList([]), /string list/)
  assert.throws(() => validateTokenList(['a', null]), /string list/)
})
