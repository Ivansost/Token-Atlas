/**
 * Display: what is drawn and how much of it.
 *
 * These were floating over the scene during M4.1 as scaffolding. They live here now, which is
 * what "nothing on the right, one panel at a time" actually means in practice.
 */
export function DisplayPanel({ settings, onChange, tokenCount, reducedMotion = false }) {
  const set = (key) => (value) => onChange({ ...settings, [key]: value })

  return (
    <>
      <Field htmlFor="field-opacity" label="Field opacity" hint="How visible the vocabulary is behind the live layer.">
        <Range id="field-opacity" min={0} max={1} step={0.01}
          value={settings.fieldOpacity} onChange={set('fieldOpacity')}
          format={(v) => `${Math.round(v * 100)}%`} />
      </Field>

      <Field htmlFor="field-size" label="Dot size" hint="Pixel size of each token. Constant, so zooming separates them.">
        <Range id="field-size" min={1} max={6} step={0.1}
          value={settings.fieldSize} onChange={set('fieldSize')} format={(v) => v.toFixed(1)} />
      </Field>

      <Field htmlFor="stride" label="Field density" hint="Thins the field uniformly — every nth token, not a filtered subset.">
        <Range id="stride" min={1} max={20} step={1}
          value={settings.stride} onChange={(v) => set('stride')(Math.round(v))}
          format={(v) => (v === 1 ? 'all' : `1 in ${v}`)} />
      </Field>

      <Field
        htmlFor="nucleus"
        label="Coverage"
        hint="How much probability the highlighted tokens must cover. A confident step lights one node; an uncertain one lights dozens."
      >
        <select
          id="nucleus"
          aria-describedby="nucleus-hint"
          value={settings.nucleus}
          onChange={(event) => set('nucleus')(Number(event.target.value))}
          className="data"
          style={select}
        >
          <option value={0.9}>top 90%</option>
          <option value={0.99}>top 99%</option>
          <option value={0.999}>top 99.9%</option>
          <option value={1}>everything sent</option>
        </select>
      </Field>

      <label style={checkboxRow}>
        <input type="checkbox" checked={settings.follow && !reducedMotion}
          disabled={reducedMotion}
          onChange={(event) => set('follow')(event.target.checked)}
          style={{ accentColor: 'var(--text-secondary)' }} />
        Follow the chosen token
      </label>

      {reducedMotion && (
        <p style={note}>Camera following is off while Reduce Motion is enabled.</p>
      )}

      <p style={note}>
        <span className="data">{tokenCount.toLocaleString()}</span> tokens, each at a fixed position
        from a UMAP projection of the model’s own embeddings.
      </p>
    </>
  )
}

function Field({ htmlFor, label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <label htmlFor={htmlFor} style={{ width: '82px', fontSize: '12.5px' }}>{label}</label>
        {children}
      </div>
      <span id={`${htmlFor}-hint`} style={note}>{hint}</span>
    </div>
  )
}

function Range({ id, min, max, step, value, onChange, format }) {
  return (
    <>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        aria-describedby={`${id}-hint`}
        aria-valuetext={format(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ flex: 1, height: '28px', accentColor: 'var(--text-secondary)' }} />
      <span className="data" style={{ color: 'var(--text-muted)', fontSize: '12px', minWidth: '5ch', textAlign: 'right' }}>
        {format(value)}
      </span>
    </>
  )
}

const select = {
  flex: 1,
  background: 'var(--surface-raised)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-hair)',
  borderRadius: 'var(--radius-sm)',
  minHeight: '28px',
  padding: '3px 5px',
  fontSize: '12px',
}

const checkboxRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  fontSize: '12.5px',
  minHeight: '28px',
  cursor: 'pointer',
}

const note = { margin: 0, fontSize: '12px', lineHeight: 1.5, color: 'var(--text-muted)' }
