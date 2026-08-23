import { useEffect, useRef } from 'react'

import { SPEEDS } from '../lib/playback'

/**
 * The transport: play, pause, restart, speed, and the timeline.
 *
 * It floats OVER the scene rather than docking to the bottom of the window. A docked bar would
 * draw a hard edge across a room that is supposed to have no edges, and the scene is the ground
 * everything else sits on top of.
 *
 * The timeline is the generated tokens themselves, not an abstract scrubber. Each cell is one
 * decision, so the strip spells out the sentence as it was written: past cells lit, the current
 * one amber, unreached ones dim. Clicking a cell jumps to that decision. It doubles as the output
 * text, which is why there is no separate "what did it say" readout anywhere in the interface.
 *
 * Collapsing leaves a pill with the play control and the step counter, so the scene can run
 * unobstructed without losing the ability to stop it.
 */
export function Transport({ steps, playback, collapsed, onToggleCollapse }) {
  const { index, playing, speed, toggle, restart, seek, setSpeed } = playback
  const total = steps.length
  const strip = useRef(null)

  // Keep the current token in view. A long run scrolls the strip past its own playhead, and a
  // timeline you have to chase is worse than no timeline.
  useEffect(() => {
    const current = strip.current?.querySelector('[data-current="true"]')
    current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [index])

  if (collapsed) {
    return (
      <div style={{ ...shell, padding: '6px 10px', gap: 'var(--space-sm)' }}>
        <IconButton label={playing ? 'Pause' : 'Play'} onClick={toggle}>
          {playing ? '❚❚' : '▶'}
        </IconButton>
        <span className="data" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
          {index + 1}/{total}
        </span>
        <IconButton label="Show the timeline" onClick={onToggleCollapse}>⌃</IconButton>
      </div>
    )
  }

  return (
    <div style={shell}>
      <IconButton label="Back to the first token" onClick={restart}>◀◀</IconButton>
      <IconButton label={playing ? 'Pause' : 'Play'} onClick={toggle} size={17}>
        {playing ? '❚❚' : '▶'}
      </IconButton>

      <div ref={strip} style={timelineStrip} role="group" aria-label="Generated tokens">
        {steps.map((step, i) => {
          const state = i === index ? 'current' : i < index ? 'past' : 'ahead'
          return (
            <button
              key={step.step}
              type="button"
              onClick={() => seek(i)}
              data-current={i === index}
              title={`step ${i + 1} — ${step.chosen.text} (${step.chosen.prob.toFixed(4)})`}
              className="token"
              style={{ ...cell, ...cellState[state] }}
            >
              {step.chosen.text.replace(/ /g, '·').replace(/\n/g, '⏎') || '·'}
            </button>
          )
        })}
      </div>

      <select
        value={speed}
        onChange={(event) => setSpeed(Number(event.target.value))}
        aria-label="Playback speed"
        className="data"
        style={speedSelect}
      >
        {SPEEDS.map((value) => (
          <option key={value} value={value}>{value}×</option>
        ))}
      </select>

      <IconButton label="Hide the timeline" onClick={onToggleCollapse}>⌄</IconButton>
    </div>
  )
}

function IconButton({ children, label, onClick, size = 14 }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      style={{ ...iconButton, fontSize: `${size}px` }}>
      {children}
    </button>
  )
}

const shell = {
  position: 'absolute',
  left: '50%',
  bottom: 'var(--space-lg)',
  transform: 'translateX(-50%)',
  maxWidth: 'min(880px, calc(100% - var(--space-xl)))',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-md)',
  padding: 'var(--space-sm) var(--space-md)',
  background: 'color-mix(in oklab, var(--surface-panel) 90%, transparent)',
  border: '1px solid var(--border-hair)',
  borderRadius: 'var(--radius-lg)',
  color: 'var(--text-secondary)',
}

const timelineStrip = {
  display: 'flex',
  gap: '2px',
  overflowX: 'auto',
  flex: 1,
  minWidth: 0,
}

const cell = {
  // A floor, not a fraction: cells that shrink to fit turn every token into "P..." and the strip
  // stops being readable as a sentence. Past the floor the strip scrolls instead.
  flex: '0 1 auto',
  minWidth: '46px',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '4px 7px',
  fontSize: '11.5px',
  lineHeight: 1.3,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  cursor: 'pointer',
}

const cellState = {
  // Amber marks the token the model chose -- here, the decision currently on screen.
  current: { background: 'var(--chosen)', color: 'var(--void)' },
  past: { background: 'var(--surface-raised)', color: 'var(--text-secondary)' },
  ahead: { background: 'color-mix(in oklab, var(--surface-raised) 55%, transparent)', color: 'var(--template)' },
}

const iconButton = {
  background: 'none',
  border: 'none',
  padding: '2px 4px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  lineHeight: 1,
}

const speedSelect = {
  background: 'var(--surface-raised)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-hair)',
  borderRadius: 'var(--radius-sm)',
  padding: '3px 4px',
  fontSize: '12px',
}
