/** Format model probability without turning a positive long-tail value into visual zero. */
export function formatProbability(value, decimals = 4) {
  if (!Number.isFinite(value) || value < 0) return '—'
  if (value === 0) return '0'
  // Switch only when fixed-point rounding would show literal zero at this precision.
  if (value < 0.5 * 10 ** -decimals) return value.toExponential(2)
  return value.toFixed(decimals)
}

/** A higher-precision reading for the detail panel, where exact inspection is the task. */
export function formatProbabilityDetail(value) {
  if (!Number.isFinite(value) || value < 0) return '—'
  if (value === 0) return '0'
  if (value < 0.0001) return value.toExponential(6)
  return value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
}
