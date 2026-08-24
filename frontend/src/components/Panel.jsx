import { X } from 'lucide-react'

/**
 * The panel shell: attached to the rail, one at a time, closable.
 *
 * It meets the rail with a hairline and no radius on that edge -- a rounded corner against a
 * flush neighbour is the tell of a card that has been dropped onto a layout rather than built
 * into one. Panels scroll internally and never nest a second scroll region.
 *
 * Headers are sentence case. Always.
 */
export function Panel({ title, children, onClose, footer }) {
  return (
    <aside style={panel} aria-label={title}>
      <header style={header}>
        <h2 style={heading}>{title}</h2>
        <button type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}
          className="icon-control"
          style={closeButton}>
          <X size={14} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </header>

      <div style={body}>{children}</div>

      {footer && <footer style={footerStyle}>{footer}</footer>}
    </aside>
  )
}

const panel = {
  width: '280px',
  flex: 'none',
  height: '100%',
  background: 'var(--surface-panel)',
  borderRight: '1px solid var(--border-hair)',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
}

const header = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-sm) var(--space-md)',
  borderBottom: '1px solid var(--border-hair)',
  flex: 'none',
}

const heading = {
  margin: 0,
  fontSize: '13px',
  fontWeight: 400,
  letterSpacing: '0.03em',
  color: 'var(--text-secondary)',
}

const closeButton = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  background: 'none',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: 0,
  color: 'var(--text-muted)',
  cursor: 'pointer',
}

const body = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: 'var(--space-md)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-md)',
}

const footerStyle = {
  flex: 'none',
  padding: 'var(--space-sm) var(--space-md)',
  borderTop: '1px solid var(--border-hair)',
  fontSize: '12px',
  color: 'var(--text-muted)',
}
