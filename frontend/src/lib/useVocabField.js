import { useEffect, useState } from 'react'

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

  useEffect(() => {
    let cancelled = false

    fetch(COORDS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.arrayBuffer()
      })
      .then((buffer) => {
        if (cancelled) return
        const positions = new Float32Array(buffer)
        if (positions.length % 3 !== 0) {
          throw new Error(`expected xyz triples, got ${positions.length} floats`)
        }
        setState({ status: 'ready', positions, count: positions.length / 3, error: null })
      })
      .catch((error) => {
        if (cancelled) return
        // A missing artifact is survivable: the app runs without the field rather than blanking.
        setState({ status: 'error', positions: null, count: 0, error: error.message })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
