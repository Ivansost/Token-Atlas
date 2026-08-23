import { useEffect, useState } from 'react'

/**
 * Loads the atlas layers: which region each token belongs to, and which tokens are neighbours.
 *
 *   vocab_clusters.bin  one uint8 region id per token, parallel to the coordinate buffer
 *   vocab_edges.bin     uint32 index pairs into that same vertex list
 *   vocab_atlas.json    region labels, sizes, and the tokens nearest each centre
 *
 * Both binaries are index-parallel to vocab_xyz.bin on purpose: the edges are drawn as an INDEX
 * buffer over the vertices the field already uploaded, so 400,139 lines cost 3.2 MB of indices
 * rather than a second copy of the geometry.
 *
 * Everything here is optional. If a file is missing the scene renders without that layer instead
 * of failing -- the field alone is still a complete picture.
 */

const base = import.meta.env.BASE_URL

async function loadBinary(url, TypedArray) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return new TypedArray(await res.arrayBuffer())
}

export function useAtlas() {
  const [state, setState] = useState({ status: 'loading', clusters: null, edges: null, atlas: null })

  useEffect(() => {
    let cancelled = false

    Promise.all([
      loadBinary(`${base}data/vocab_clusters.bin`, Uint8Array),
      loadBinary(`${base}data/vocab_edges.bin`, Uint32Array),
      fetch(`${base}data/vocab_atlas.json`).then((r) => r.json()),
    ])
      .then(([clusters, edges, atlas]) => {
        if (!cancelled) setState({ status: 'ready', clusters, edges, atlas })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'absent', clusters: null, edges: null, atlas: null })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
