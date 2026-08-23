import { useMemo, useState } from 'react'

import { Scene } from './components/Scene'
import { toRGB } from './design/color'
import { regionHues } from './design/palette'
import { scene as sceneDefaults } from './design/tokens'
import { useAtlas } from './lib/useAtlas'
import { useVocabField } from './lib/useVocabField'

/**
 * M4.1: the room, the field, and the atlas layers. The live layer is next.
 *
 * The icon rail and its attached panels arrive at M4.2. The controls below are provisional --
 * they exist so the field can be judged while it is being tuned, and they move into the Display
 * panel when the rail is built.
 */
export default function App() {
  const field = useVocabField()
  const atlas = useAtlas()

  const [fieldOpacity, setFieldOpacity] = useState(sceneDefaults.fieldOpacity)
  const [fieldSize, setFieldSize] = useState(sceneDefaults.fieldPointSize)
  const [edgeOpacity, setEdgeOpacity] = useState(sceneDefaults.edgeOpacity)

  const regionCount = atlas.atlas?.clusters ?? 0
  const hues = useMemo(() => regionHues(regionCount || 1), [regionCount])
  const palette = useMemo(() => hues.map(toRGB), [hues])

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <h1 className="sr-only">AI Visualizer — the model’s vocabulary in three dimensions</h1>

      <Scene
        field={field}
        atlas={atlas}
        palette={palette}
        fieldOpacity={fieldOpacity}
        fieldSize={fieldSize}
        edgeOpacity={edgeOpacity}
      />

      <div style={controlBar}>
        <Slider label="Field" id="field-opacity" value={fieldOpacity} onChange={setFieldOpacity}
          min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Dot" id="field-size" value={fieldSize} onChange={setFieldSize}
          min={1} max={6} step={0.1} width={80} format={(v) => v.toFixed(1)} />
        <Slider label="Links" id="edge-opacity" value={edgeOpacity} onChange={setEdgeOpacity}
          min={0} max={0.5} step={0.005} format={(v) => `${Math.round((v / 0.5) * 100)}%`} />

        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
          {field.status === 'ready' && (
            <>
              <span className="data">{field.count.toLocaleString()}</span> tokens
              {atlas.status === 'ready' && (
                <>
                  {' · '}
                  <span className="data">{atlas.atlas.edges.toLocaleString()}</span> links
                  {' · '}
                  <span className="data">{regionCount}</span> regions
                </>
              )}
            </>
          )}
          {field.status === 'loading' && 'loading the vocabulary…'}
          {field.status === 'error' && `field unavailable — ${field.error}`}
        </span>
      </div>

      {atlas.status === 'ready' && <RegionLegend regions={atlas.atlas.regions} hues={hues} />}
    </div>
  )
}

/**
 * What the colours mean.
 *
 * Every hue is a region found by clustering the projected space, labelled with the tokens nearest
 * its centre -- so the legend is not a key invented for the picture, it is the evidence that the
 * regions are real. The palette generator refuses to emit anything in the amber band, because
 * amber belongs to the chosen token alone.
 */
function RegionLegend({ regions, hues }) {
  const [open, setOpen] = useState(false)
  const shown = open ? regions : regions.slice(0, 6)

  return (
    <div style={{ ...legendBox, maxHeight: open ? '70vh' : 'auto' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={legendToggle}>
        Regions of the vocabulary
        <span style={{ color: 'var(--text-muted)' }}>{open ? '−' : `+${regions.length - 6}`}</span>
      </button>

      <div style={{ overflowY: open ? 'auto' : 'visible' }}>
        {shown.map((region) => (
          <div key={region.id} style={legendRow}>
            <span style={{ ...swatch, background: hues[region.id % hues.length] }} />
            <span className="token" style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>
              {region.examples.slice(0, 3).join('  ')}
            </span>
            <span className="data" style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '11px' }}>
              {region.count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Slider({ label, id, value, onChange, min, max, step, width = 110, format }) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: `${width}px`, accentColor: 'var(--candidate)' }}
      />
      <span className="data" style={{ color: 'var(--text-muted)', minWidth: '4ch' }}>
        {format(value)}
      </span>
    </>
  )
}

const panelSurface = {
  background: 'color-mix(in oklab, var(--surface-panel) 88%, transparent)',
  border: '1px solid var(--border-hair)',
  borderRadius: 'var(--radius-lg)',
}

const controlBar = {
  ...panelSurface,
  position: 'absolute',
  left: 'var(--space-lg)',
  right: 'var(--space-lg)',
  bottom: 'var(--space-lg)',
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--space-md)',
  padding: 'var(--space-sm) var(--space-md)',
  fontSize: '13px',
  fontWeight: 300,
  letterSpacing: '0.02em',
  color: 'var(--text-secondary)',
}

const legendBox = {
  ...panelSurface,
  position: 'absolute',
  left: 'var(--space-lg)',
  top: 'var(--space-lg)',
  width: '290px',
  padding: 'var(--space-sm)',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
}

const legendToggle = {
  display: 'flex',
  justifyContent: 'space-between',
  width: '100%',
  background: 'none',
  border: 'none',
  padding: '2px 4px 6px',
  color: 'var(--text-secondary)',
  font: 'inherit',
  fontSize: '12px',
  letterSpacing: '0.03em',
  cursor: 'pointer',
}

const legendRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  padding: '2px 4px',
}

const swatch = {
  width: '9px',
  height: '9px',
  borderRadius: '2px',
  flex: 'none',
}
