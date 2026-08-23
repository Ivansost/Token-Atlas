import { useMemo } from 'react'
import * as THREE from 'three'

import { toHex } from '../design/color'
import { theme } from '../design/tokens'

/**
 * The neighbour graph: 400,139 lines, one draw call.
 *
 * These are not decoration and they are not a force layout. UMAP builds a k-nearest-neighbour
 * graph over the model's embeddings and then positions the points to respect it; this is that
 * same graph, computed with the same library on the same normalised embeddings with the same
 * cosine metric. A line between two tokens means the model represents them similarly.
 *
 * So the filaments visible in the field are not an artifact of the picture -- they ARE the
 * structure the picture was laid out from. Drawing them states out loud what the positions were
 * already implying.
 *
 * The geometry shares the field's vertex buffer and adds only an index buffer, so the whole layer
 * costs 3.2 MB of indices rather than a second copy of 151,665 positions.
 */
export function VocabEdges({ positions, edges, opacity = 0.12 }) {
  const geometry = useMemo(() => {
    if (!positions || !edges) return null
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setIndex(new THREE.BufferAttribute(edges, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 120)
    return geo
  }, [positions, edges])

  if (!geometry || opacity <= 0) return null

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial
        // Dimmer and cooler than the points. The links are the substrate the field sits in;
        // when they read brighter than the tokens they connect, the picture inverts.
        color={toHex(theme.color.template)}
        transparent
        opacity={opacity}
        // Very low per-line alpha on purpose: individually a neighbour link says almost nothing,
        // but 400k of them accumulate into the visible shape of the space. Density carries the
        // signal, exactly as it does for the points.
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        fog
      />
    </lineSegments>
  )
}
