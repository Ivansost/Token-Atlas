/**
 * The cold-start banner: the honest answer to "why is nothing happening?"
 *
 * The deploy target scales to zero, so a first visitor commonly arrives at a sleeping container
 * and waits through a container boot plus a short weight load. That wait is the worst moment in the
 * product, and it happens before anyone has opened a panel — so the explanation has to live on the
 * scene, not inside the Run panel where only a curious visitor would find it.
 *
 * It says what is actually happening and roughly how long, which is the difference between a wait
 * and a broken page. It disappears the moment the model is live, because a permanent status chip
 * is chrome that stopped carrying information.
 */
export function ConnectionStatus({ run }) {
  const message = statusFor(run)
  if (!message) return null

  return (
    <div style={shell} role="status" aria-live="polite">
      <span style={dot} />
      <span>{message}</span>
    </div>
  )
}

function statusFor(run) {
  if (run.connection === 'connecting') return 'Connecting to the model…'

  if (run.connection === 'waking') {
    return 'Waking the model — the server sleeps when idle, so this takes up to a minute.'
  }

  // Connected, weights not yet in memory. Measured in the container: ~1.2 s, because they are
  // baked into the image rather than downloaded. Deliberately does NOT promise a number -- the
  // wait a visitor actually feels is the host's container boot, which we do not control.
  if (run.connection === 'live' && run.modelLoaded === false && !run.generating) {
    return 'Loading the model — 494 million weights, once.'
  }

  return null
}

const shell = {
  position: 'absolute',
  top: 'var(--space-lg)',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  maxWidth: 'min(560px, calc(100% - var(--space-xl)))',
  padding: 'var(--space-sm) var(--space-md)',
  background: 'color-mix(in oklab, var(--surface-panel) 92%, transparent)',
  border: '1px solid var(--border-hair)',
  borderRadius: 'var(--radius-lg)',
  color: 'var(--text-secondary)',
  fontSize: '13px',
  fontWeight: 400,
  letterSpacing: '0.02em',
}

// A neutral status marker. Candidate milk remains reserved for model data.
const dot = {
  width: '7px',
  height: '7px',
  flex: 'none',
  borderRadius: '50%',
  background: 'var(--text-secondary)',
}
