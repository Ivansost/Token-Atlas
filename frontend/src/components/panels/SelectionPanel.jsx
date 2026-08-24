/**
 * Selection: the full detail for whatever was clicked, in the scene or in the list.
 *
 * Anything in the vocabulary can be selected, not only this step's candidates -- clicking a dim
 * field token names it too, and says plainly that the model did not consider it here. A point you
 * cannot interrogate is decoration, and this panel is what keeps 151,665 of them from being that.
 */
export function SelectionPanel({ selection, step, textFor }) {
  if (!selection) {
    return (
      <p style={note}>
        Click any token in the scene — a lit candidate or a dim one out in the field — and its
        numbers appear here.
      </p>
    )
  }

  const text = selection.text ?? textFor(selection.id)
  const isCandidate = selection.prob != null
  const rank = isCandidate && step
    ? step.candidates.findIndex((c) => c.id === selection.id) + 1
    : null

  return (
    <>
      <div>
        <span className="token" style={{
          fontSize: '19px',
          color: selection.chosen ? 'var(--chosen)' : 'var(--text-primary)',
        }}>
          {(text ?? '…').replace(/ /g, '·').replace(/\n/g, '⏎') || '·'}
        </span>
        {selection.chosen && <p style={{ ...note, color: 'var(--chosen)' }}>The model emitted this.</p>}
      </div>

      <dl style={grid}>
        <Row label="Token id" value={selection.id} mono />
        {isCandidate && <Row label="Probability" value={selection.prob.toFixed(6)} mono />}
        {rank > 0 && <Row label="Rank this step" value={`${rank} of ${step.candidates.length}`} mono />}
        {selection.pos3d && (
          <Row label="Position" mono
            value={`[${selection.pos3d.map((v) => Number(v).toFixed(2)).join(', ')}]`} />
        )}
      </dl>

      {!isCandidate && (
        <p style={note}>
          Not among this step’s candidates. The model gave it some probability — everything does —
          but too little to be sent.
        </p>
      )}

      <p style={note}>
        Position comes from the model’s own embedding for this token, not from a layout. Tokens
        near it are ones the model represents similarly.
      </p>
    </>
  )
}

function Row({ label, value, mono }) {
  return (
    <>
      <dt style={dt}>{label}</dt>
      <dd className={mono ? 'data' : undefined} style={dd}>{value}</dd>
    </>
  )
}

const grid = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '4px var(--space-md)',
  margin: 0,
  fontSize: '12px',
}

const dt = { color: 'var(--text-muted)' }
const dd = { margin: 0, color: 'var(--text-secondary)', textAlign: 'right', overflowWrap: 'anywhere' }
const note = { margin: '4px 0 0', fontSize: '11.5px', lineHeight: 1.55, color: 'var(--text-muted)' }
