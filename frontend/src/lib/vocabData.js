/** Decode and validate committed vocabulary artifacts before they reach rendering code. */
export function decodeCoordinateBuffer(buffer) {
  if (!(buffer instanceof ArrayBuffer)) throw new TypeError('coordinate response was not binary')
  if (buffer.byteLength === 0 || buffer.byteLength % 12 !== 0) {
    throw new Error(`expected xyz float32 triples, got ${buffer.byteLength} bytes`)
  }
  return new Float32Array(buffer)
}

export function validateTokenList(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0 || !tokens.every((token) => typeof token === 'string')) {
    throw new Error('token-label response was not a non-empty string list')
  }
  return tokens
}
