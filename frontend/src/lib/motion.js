export const FOLLOW_RATE_PER_SECOND = 2.76

/** Frame-rate-independent exponential damping amount for one animation frame. */
export function dampingAmount(deltaSeconds, rate = FOLLOW_RATE_PER_SECOND) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0
  return 1 - Math.exp(-rate * Math.min(deltaSeconds, 0.1))
}
