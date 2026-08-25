import { useCallback, useEffect, useState } from 'react'

import { decodeCoordinateBuffer } from './vocabData'

/**
 * Loads the vocabulary's 3D coordinates.
 *
 * `public/data/vocab_xyz.bin` is a raw little-endian float32 dump of 151,665 xyz triples,
 * written by backend/scripts/build_projection.py. There is nothing to parse -- the bytes are
 * already the exact memory layout a Float32Array wants, and the same layout Three.js wants for
 * a BufferAttribute, so it goes from the network to the GPU without a copy or a decode step.
 *
 * The positions come from a UMAP projection of the model's own input embeddings, computed once
 * offline and committed. They never change: a token occupies the same place in every run and at
 * every step, which is the whole reason position is allowed to mean something.
 */

const COORDS_URL = `${import.meta.env.BASE_URL}data/vocab_xyz.bin`

export function useVocabField() {
  const [state, setState] = useState({ status: 'loading', positions: null, count: 0, error: null })
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => {
    setState({ status: 'loading', positions: null, count: 0, error: null })
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    fetch(COORDS_URL, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.arrayBuffer()
      })
      .then((buffer) => {
        const positions = decodeCoordinateBuffer(buffer)
        setState({ status: 'ready', positions, count: positions.length / 3, error: null })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          // Generation survives without the field, but the interface names the failure and offers
          // recovery rather than silently replacing the atlas with an empty room.
          setState({ status: 'error', positions: null, count: 0, error: error.message })
        }
      })

    return () => controller.abort()
  }, [attempt])

  return { ...state, retry }
}
