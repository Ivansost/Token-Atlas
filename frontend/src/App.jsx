import { useState } from 'react'

import { Scene } from './components/Scene'
import { Transport } from './components/Transport'
import { usePlayback } from './lib/playback'
import { useSteps } from './lib/useSteps'
import { useVocabField } from './lib/useVocabField'
import { scene as sceneDefaults } from './design/tokens'

/**
 * M4.1: the room, the field, one decision at a time, and playback.
 *
 * The icon rail and its attached panels arrive at M4.2, and the display controls below move into
 * the Display panel when it exists. They are provisional, and deliberately in the top-left rather
 * than the right: nothing lives on the right in this layout.
 */
export default function App() {
  const field = useVocabField()
  const run = useSteps()
  const playback = usePlayback(run.steps.length)

  const [fieldOpacity, setFieldOpacity] = useState(sceneDefaults.fieldOpacity)
  const [fieldSize, setFieldSize] = useState(sceneDefaults.fieldPointSize)
  const [follow, setFollow] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  const step = run.steps[playback.index] ?? null

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <h1 className="sr-only">AI Visualizer — watch a language model choose each word</h1>

      <Scene
        field={field}
        fieldOpacity={fieldOpacity}
        fieldSize={fieldSize}
        step={step}
        follow={follow}
      />

      <div style={leftColumn}>
      <div style={displayPanel}>
        <Slider label="Field" id="field-opacity" value={fieldOpacity} onChange={setFieldOpacity}
          min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Dot" id="field-size" value={fieldSize} onChange={setFieldSize}
          min={1} max={6} step={0.1} format={(v) => v.toFixed(1)} />

        <label style={checkboxRow}>
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)}
            style={{ accentColor: 'var(--candidate)' }} />
          Follow the chosen token
        </label>

        <div style={{ color: 'var(--text-muted)', fontSize: '11.5px', paddingTop: '2px' }}>
          {field.status === 'ready'
            ? <><span className="data">{field.count.toLocaleString()}</span> tokens · fixture run</>
            : field.status === 'loading' ? 'loading the vocabulary…' : `field unavailable — ${field.error}`}
        </div>
      </div>

      {step && (
        <div style={readout}>
          <span className="token" style={{ color: 'var(--chosen)', fontSize: '15px' }}>
            {step.chosen.text.replace(/ /g, '·')}
          </span>
          <span className="data" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            p={step.chosen.prob.toFixed(4)} · {step.candidates.length} considered ·{' '}
            {step.attention.length} attention links
          </span>
        </div>
      )}
      </div>

      {run.steps.length > 0 && (
        <Transport
          steps={run.steps}
          playback={playback}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
      )}
    </div>
  )
}

function Slider({ label, id, value, onChange, min, max, step, format }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
      <label htmlFor={id} style={{ width: '38px' }}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ flex: 1, accentColor: 'var(--candidate)' }} />
      <span className="data" style={{ color: 'var(--text-muted)', minWidth: '4ch', fontSize: '12px' }}>
        {format(value)}
      </span>
    </div>
  )
}

const floating = {
  position: 'absolute',
  background: 'color-mix(in oklab, var(--surface-panel) 90%, transparent)',
  border: '1px solid var(--border-hair)',
  borderRadius: 'var(--radius-lg)',
  color: 'var(--text-secondary)',
  fontSize: '13px',
  fontWeight: 300,
  letterSpacing: '0.02em',
}

const leftColumn = {
  position: 'absolute',
  left: 'var(--space-lg)',
  top: 'var(--space-lg)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
  // The transport floats along the bottom centre, so the left column stays out of its lane
  // rather than stacking underneath it.
  maxHeight: 'calc(100% - 120px)',
}

const displayPanel = {
  ...floating,
  position: 'static',
  width: '260px',
  padding: 'var(--space-md)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
}

const readout = {
  ...floating,
  position: 'static',
  width: '260px',
  padding: 'var(--space-sm) var(--space-md)',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
}

const checkboxRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  fontSize: '12.5px',
  cursor: 'pointer',
}
