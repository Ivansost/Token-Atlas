import { lazy, Suspense, useEffect, useState } from 'react'

const DesktopApp = lazy(() => import('./DesktopApp.jsx'))

const UNSUPPORTED_VIEWPORT =
  '(max-width: 899px), (max-height: 559px), (hover: none) and (pointer: coarse)'
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

export default function App() {
  const unsupported = useMediaQuery(UNSUPPORTED_VIEWPORT)
  const reducedMotion = useMediaQuery(REDUCED_MOTION)

  if (unsupported) return <DesktopRequired />

  return (
    <Suspense fallback={<LoadingAtlas />}>
      <DesktopApp reducedMotion={reducedMotion} />
    </Suspense>
  )
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}

function DesktopRequired() {
  return (
    <MessageFrame>
      <h1 style={messageHeading}>Token Atlas is built for a computer.</h1>
      <p style={messageBody}>
        This is an interactive 3D map of 151,665 tokens. It needs the space and precision of a
        laptop or desktop browser.
      </p>
      <p style={messageNote}>
        Open this link on a computer with a viewport at least{' '}
        <span className="data">900 × 560</span> and a mouse or trackpad.
      </p>
    </MessageFrame>
  )
}

function LoadingAtlas() {
  return (
    <MessageFrame>
      <h1 style={messageHeading}>Token Atlas</h1>
      <p role="status" style={messageBody}>Loading the interactive atlas…</p>
    </MessageFrame>
  )
}

function MessageFrame({ children }) {
  return (
    <main style={messageShell}>
      <div style={messageContent}>{children}</div>
    </main>
  )
}

const messageShell = {
  width: '100%',
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  padding: 'var(--space-lg)',
  background: 'var(--void)',
}

const messageContent = {
  width: 'min(100%, 520px)',
  padding: 'var(--space-xl) 0',
  borderTop: '1px solid var(--border-hair)',
  borderBottom: '1px solid var(--border-hair)',
}

const messageHeading = {
  maxWidth: '18ch',
  margin: 0,
  color: 'var(--text-primary)',
  fontSize: 'clamp(24px, 7vw, 34px)',
  fontWeight: 400,
  lineHeight: 1.2,
  letterSpacing: '-0.02em',
}

const messageBody = {
  maxWidth: '52ch',
  margin: 'var(--space-lg) 0 0',
  color: 'var(--text-secondary)',
  fontSize: '15px',
  lineHeight: 1.65,
}

const messageNote = {
  maxWidth: '56ch',
  margin: 'var(--space-md) 0 0',
  color: 'var(--text-muted)',
  fontSize: '13px',
  lineHeight: 1.6,
}
