/**
 * The icon rail: the only permanently visible chrome.
 *
 * Each icon opens exactly ONE attached panel. Clicking the active icon closes it, so the scene
 * runs full width -- the room is the ground, and the chrome is a thing you summon over it rather
 * than a frame it lives inside.
 *
 * The active state is carried by surface and text lightness, never by colour. Amber belongs to
 * the token the model chose, and spending it on "which tab is open" is precisely the drift the
 * Amber Law exists to stop.
 */
export function Rail({ panels, active, onSelect }) {
  return (
    <nav style={rail} aria-label="Panels">
      {panels.map(({ id, label, Icon }) => {
        const isActive = id === active
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(isActive ? null : id)}
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            style={{ ...railButton, ...(isActive ? railButtonActive : null) }}
          >
            <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
          </button>
        )
      })}
    </nav>
  )
}

const rail = {
  width: '48px',
  flex: 'none',
  height: '100%',
  background: 'var(--surface-rail)',
  borderRight: '1px solid var(--border-hair)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2px',
  paddingTop: 'var(--space-sm)',
}

const railButton = {
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
}

const railButtonActive = {
  background: 'var(--surface-raised)',
  color: 'var(--text-primary)',
}
