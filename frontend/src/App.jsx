import { useState } from 'react'

import { Scene } from './components/Scene'
import { Transport } from './components/Transport'
import { usePlayback } from './lib/playback'
import { useSteps } from './lib/useSteps'
import { useVocabField } from './lib/useVocabField'
import { useVocabTokens } from './lib/useVocabTokens'
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
  const [nucleus, setNucleus] = useState(0.99)
  const [stride, setStride] = useState(1)
  const [selected, setSelected] = useState(null)

  // Token text is 1.59 MB and only needed once someone actually clicks something.
  const vocab = useVocabTokens({ enabled: Boolean(selected) })
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
        nucleus={nucleus}
        stride={stride}
        selected={selected}
        onSelect={setSelected}
      />

      <div style={leftColumn}>
      <div style={displayPanel}>
        <Slider label="Field" id="field-opacity" value={fieldOpacity} onChange={setFieldOpacity}
          min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Dot" id="field-size" value={fieldSize} onChange={setFieldSize}
          min={1} max={6} step={0.1} format={(v) => v.toFixed(1)} />

        <Slider label="Shown" id="stride" value={stride} onChange={(v) => setStride(Math.round(v))}
          min={1} max={20} step={1}
          format={(v) => (v === 1 ? 'all' : `1 in ${v}`)} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <label htmlFor="nucleus" style={{ width: '38px' }}>Lit</label>
          <select id="nucleus" value={nucleus} onChange={(e) => setNucleus(Number(e.target.value))}
            className="data" style={select}>
            <option value={0.9}>top 90% of probability</option>
            <option value={0.99}>top 99%</option>
            <option value={0.999}>top 99.9%</option>
            <option value={1}>everything sent</option>
          </select>
        </div>

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

      {selected && (
        <div style={readout}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="token" style={{ color: 'var(--text-primary)', fontSize: '15px' }}>
              {(selected.text ?? vocab.textFor(selected.id) ?? '…').replace(/ /g, '·') || '·'}
            </span>
            <button type="button" onClick={() => setSelected(null)} style={closeButton}
              aria-label="Clear selection">✕</button>
          </div>
          <span className="data" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            id {selected.id}
            {selected.prob != null && ` · p=${selected.prob.toFixed(6)}`}
            {selected.source === 'field' && ' · not among this step\u2019s candidates'}
          </span>
          {selected.pos3d && (
            <span className="data" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              [{selected.pos3d.map((v) => Number(v).toFixed(2)).join(', ')}]
            </span>
          )}
        </div>
      )}

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

const select = {
  flex: 1,
  background: 'var(--surface-raised)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-hair)',
  borderRadius: 'var(--radius-sm)',
  padding: '3px 4px',
  fontSize: '11.5px',
}

const closeButton = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '12px',
  padding: 0,
}
