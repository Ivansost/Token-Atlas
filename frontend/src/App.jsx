import { useState } from 'react'

import { Scene } from './components/Scene'
import { useVocabField } from './lib/useVocabField'
import { scene as sceneDefaults } from './design/tokens'

/**
 * M4.1: the room and the field, nothing else yet.
 *
 * The icon rail and its attached panels arrive at M4.2. The control below is provisional -- it
 * exists so the field's opacity is adjustable while we judge the projection, and it moves into
 * the Display panel when the rail is built.
 */
export default function App() {
  const field = useVocabField()
  const [fieldOpacity, setFieldOpacity] = useState(sceneDefaults.fieldOpacity)

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <h1 className="sr-only">AI Visualizer — the model’s vocabulary in three dimensions</h1>

      <Scene field={field} fieldOpacity={fieldOpacity} />

      <div
        style={{
          position: 'absolute',
          left: 'var(--space-lg)',
          bottom: 'var(--space-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          padding: 'var(--space-sm) var(--space-md)',
          background: 'color-mix(in oklab, var(--surface-panel) 88%, transparent)',
          border: '1px solid var(--border-hair)',
          borderRadius: 'var(--radius-lg)',
          fontSize: '13px',
          fontWeight: 300,
          letterSpacing: '0.02em',
          color: 'var(--text-secondary)',
        }}
      >
        <label htmlFor="field-opacity">Field</label>
        <input
          id="field-opacity"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={fieldOpacity}
          onChange={(event) => setFieldOpacity(Number(event.target.value))}
          style={{ width: '140px', accentColor: 'var(--candidate)' }}
        />
        <span className="data" style={{ color: 'var(--text-muted)', minWidth: '3.5ch' }}>
          {Math.round(fieldOpacity * 100)}%
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          {field.status === 'ready' && (
            <>
              <span className="data">{field.count.toLocaleString()}</span> tokens
            </>
          )}
          {field.status === 'loading' && 'loading the vocabulary…'}
          {field.status === 'error' && `field unavailable — ${field.error}`}
        </span>
      </div>
    </div>
  )
}
