import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * The numbers panel: everything the model considered at this step, ranked, with its real figures.
 *
 * The 3D scene is what makes someone stop scrolling. This is the receipts -- it is what makes the
 * project survive ten minutes of questioning instead of thirty seconds of admiration. Every value
 * here came off a forward pass; none of it is derived for display.
 *
 * It needs no schema change to exist, which was the check at M2 that the event shape was right.
 */
export function CandidatesPanel({
  step,
  nucleus,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
  reducedMotion = false,
}) {
  const listRef = useRef(null)
  const [focusedId, setFocusedId] = useState(null)

  const { rows, cutoff, mass } = useMemo(() => {
    if (!step) return { rows: [], cutoff: 0, mass: 0 }
    let running = 0
    let cut = step.candidates.length
    const out = step.candidates.map((candidate, i) => {
      running += candidate.prob
      if (cut === step.candidates.length && running >= nucleus) cut = i + 1
      return { ...candidate, rank: i + 1, cumulative: running }
    })
    return { rows: out, cutoff: cut, mass: running }
  }, [step, nucleus])

  // A node clicked in the scene scrolls its row into view here. Cross-highlighting has to work in
  // both directions or the two views are just two views.
  useEffect(() => {
    if (selectedId == null) return
    listRef.current?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [selectedId, reducedMotion])

  const moveFocus = (event, index) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()

    const buttons = [...(listRef.current?.querySelectorAll('[data-candidate-row="true"]') ?? [])]
    let next = index
    if (event.key === 'ArrowDown') next = Math.min(buttons.length - 1, index + 1)
    if (event.key === 'ArrowUp') next = Math.max(0, index - 1)
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = buttons.length - 1
    buttons[next]?.focus()
  }

  if (!step) return <p style={empty}>No step selected.</p>

  const selectedRow = rows.find((row) => row.id === selectedId)
  const tabStopId = focusedId ?? selectedRow?.id ?? rows[0]?.id

  return (
    <>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)' }}>
          <span className="token" style={{ color: 'var(--chosen)', fontSize: '17px' }}>
            {step.chosen.text.replace(/ /g, '·') || '·'}
          </span>
          <span className="data" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            {step.chosen.prob.toFixed(4)}
          </span>
        </div>
        <p style={note}>
          <span className="data">{cutoff}</span> of <span className="data">{rows.length}</span>{' '}
          candidates hold {(nucleus * 100).toFixed(nucleus === 0.999 ? 1 : 0)}% of the probability.
          {cutoff === 1 && ' The model was completing, not choosing.'}
        </p>
      </div>

      <div ref={listRef} style={list} role="group" aria-label="Ranked candidate tokens">
        {rows.map((row, index) => {
          const inNucleus = row.rank <= cutoff
          const isChosen = row.id === step.chosen.id
          const isHovered = row.id === hoveredId
          const isSelected = row.id === selectedId
          return (
            <button
              key={row.id}
              type="button"
              data-candidate-row="true"
              data-selected={isSelected}
              aria-pressed={isSelected}
              tabIndex={row.id === tabStopId ? 0 : -1}
              onMouseEnter={() => onHover?.(row.id)}
              onMouseLeave={() => onHover?.(null)}
              onFocus={() => {
                setFocusedId(row.id)
                onHover?.(row.id)
              }}
              onBlur={() => onHover?.(null)}
              onKeyDown={(event) => moveFocus(event, index)}
              onClick={() => {
                setFocusedId(row.id)
                onSelect?.({ ...row, source: 'candidate', chosen: isChosen })
              }}
              style={{
                ...rowStyle,
                background: isSelected || isHovered ? 'var(--surface-raised)' : 'transparent',
              }}
            >
              <span className="data" style={rank}>{row.rank}</span>
              <span className="token" style={{
                ...tokenText,
                color: isChosen
                  ? 'var(--chosen)'
                  : inNucleus ? 'var(--text-primary)' : 'var(--text-muted)',
              }}>
                {row.text.replace(/ /g, '·').replace(/\n/g, '⏎') || '·'}
              </span>
              <span className="data" style={{
                ...prob,
                color: inNucleus ? 'var(--text-secondary)' : 'var(--text-muted)',
              }}>
                {row.prob.toFixed(4)}
              </span>
              <span style={track}>
                {/* Square root, matching the node sizing. Linear bars would render everything
                    below rank 3 as an invisible sliver. */}
                <span style={{
                  ...fill,
                  width: `${Math.max(1.5, Math.sqrt(row.prob) * 100)}%`,
                  background: isChosen
                    ? 'var(--chosen)'
                    : inNucleus ? 'var(--candidate)' : 'var(--field)',
                }} />
              </span>
            </button>
          )
        })}
      </div>

      <p style={note}>
        These {rows.length} hold <span className="data">{(mass * 100).toFixed(2)}%</span> of the
        distribution. The other {(151665 - rows.length).toLocaleString()} tokens share the rest.
      </p>
    </>
  )
}

const list = { display: 'flex', flexDirection: 'column', gap: '1px' }

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: '22px minmax(0, 1fr) 46px 52px',
  alignItems: 'center',
  minHeight: '28px',
  gap: 'var(--space-sm)',
  padding: '3px 4px',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
}

const rank = { color: 'var(--text-muted)', fontSize: '12px', textAlign: 'right' }
const tokenText = { fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const prob = { fontSize: '12px', textAlign: 'right' }
const track = { height: '3px', borderRadius: '2px', background: 'var(--surface-raised)', overflow: 'hidden' }
const fill = { display: 'block', height: '100%', borderRadius: '2px' }

const note = { margin: 0, fontSize: '12.5px', lineHeight: 1.55, color: 'var(--text-muted)' }
const empty = { ...note, margin: 0 }
