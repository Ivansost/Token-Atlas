/**
 * Radial de-clumping: a display transform, in the same family as a log axis.
 *
 * MEASURED, which is why this file exists. Radii in the UMAP projection run out to 86.7, but the
 * median token sits at 16.5 and 57% of the vocabulary is inside radius 20 -- so more than half of
 * everything the model knows is packed into under 1% of the volume it occupies. That is not a
 * rendering bug and no amount of dot-size tuning fixes it: the core is genuinely that dense, and
 * at any zoom level that shows the whole atlas it reads as one bright clot with a thin haze
 * around it.
 *
 * The transform is a RADIAL HISTOGRAM EQUALISATION. Each token's distance from the centre is
 * replaced by the distance that would put it at the same rank in a uniformly dense ball. Half the
 * vocabulary is inside the median radius before and after; it is just that the median radius is
 * now most of the way out, so the crowd has somewhere to stand.
 *
 * What it preserves, exactly:
 *   - DIRECTION. Every token keeps its angle from the centre, untouched. The regions the
 *     projection found are in the same places; they are further apart.
 *   - RADIAL ORDER. The map is monotonic in r, so a token nearer the centre than another before
 *     is nearer after. Nothing is reordered and nothing crosses.
 *
 * What it does not preserve: absolute distance. Two tokens one unit apart in the core end up
 * further apart than two tokens one unit apart at the rim. That is the entire point, and it is
 * the same bargain this project already makes when it draws probability on a square-root scale --
 * a range that spans three orders of magnitude cannot be shown faithfully on a linear axis and
 * also be seen.
 *
 * So it is honest as long as it is disclosed and as long as it can be turned off. Both hold: the
 * Display panel exposes it as `spread` with a real 0, and 0 restores the raw projection exactly.
 * The Selection panel keeps reporting RAW coordinates, because those are the data.
 */

// 512 quantiles over ~40k sampled radii. Finer than the eye can resolve, coarse enough that the
// table builds in a few milliseconds and the per-point lookup is a short binary search.
const TABLE = 512

/**
 * Build the radius→quantile table once from the field. Sampled, not exhaustive: the radial
 * distribution of 40,000 tokens and of 151,665 tokens agree far beyond the precision this needs.
 */
export function buildAtlasSpace(positions, count) {
  const step = Math.max(1, Math.floor(count / 40000))
  const radii = []
  for (let i = 0; i < count; i += step) {
    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    radii.push(Math.sqrt(x * x + y * y + z * z))
  }
  radii.sort((a, b) => a - b)

  const quantiles = new Float32Array(TABLE + 1)
  for (let k = 0; k <= TABLE; k += 1) {
    quantiles[k] = radii[Math.round((k / TABLE) * (radii.length - 1))]
  }
  return { quantiles, outer: radii[radii.length - 1] || 1 }
}

/** What fraction of the vocabulary lies inside radius `r`. Interpolated between table entries. */
function quantileAt({ quantiles }, r) {
  let lo = 0
  let hi = TABLE
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (quantiles[mid] < r) lo = mid + 1
    else hi = mid
  }
  if (lo === 0) return 0
  const a = quantiles[lo - 1]
  const b = quantiles[lo]
  const frac = b > a ? (r - a) / (b - a) : 0
  return Math.min(1, (lo - 1 + frac) / TABLE)
}

/**
 * The scale factor to apply to a point at radius `r`.
 *
 * Cube root because volume goes as r³: a token at quantile q belongs at radius `outer * q^(1/3)`
 * if density is to be even. `spread` blends between the raw radius and that one, so the control
 * is continuous rather than a toggle between two looks.
 */
function factorFor(space, r, spread) {
  if (r < 1e-6) return 1
  const target = space.outer * Math.cbrt(quantileAt(space, r))
  return (r + (target - r) * spread) / r
}

/** A `[x,y,z] -> [x,y,z]` projector for the handful of live points drawn each frame. */
export function makeProjector(space, spread) {
  if (!space || spread <= 0) return (p) => p
  return (p) => {
    if (!p) return p
    const [x, y, z] = p
    const k = factorFor(space, Math.sqrt(x * x + y * y + z * z), spread)
    return [x * k, y * k, z * k]
  }
}

/** The same transform over the whole field buffer, in place of a copy per point. */
export function expandField(positions, count, space, spread) {
  if (!space || spread <= 0) return positions
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    const k = factorFor(space, Math.sqrt(x * x + y * y + z * z), spread)
    out[i * 3] = x * k
    out[i * 3 + 1] = y * k
    out[i * 3 + 2] = z * k
  }
  return out
}
