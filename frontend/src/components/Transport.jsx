import { ChevronDown, ChevronUp, ChevronsLeft, Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'

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
export function Transport({ steps, playback, collapsed, onToggleCollapse, reducedMotion = false }) {
  const { index, playing, speed, toggle, restart, seek, setSpeed } = playback
  const total = steps.length
  const strip = useRef(null)

  // Keep the current token in view. A long run scrolls the strip past its own playhead, and a
  // timeline you have to chase is worse than no timeline.
  useEffect(() => {
    const current = strip.current?.querySelector('[data-current="true"]')
    current?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [index, reducedMotion])

  /**
   * Tokens grouped into the words they spell.
   *
   * The model does not emit words, it emits tokens: `vacation` arrives as `·vac` then `ation`, two
   * separate decisions with two separate distributions. Merging them would be a lie about how the
   * model works, and this project's whole claim is that it does not lie about that.
   *
   * So the grouping is visual only. A token starts a new word when it begins with a space; one
   * that does not is a continuation and butts against its predecessor. Punctuation attaches to the
   * word before it, the way it does in writing. Every fragment stays its own cell, its own click
   * target, and its own step.
   */
  const words = useMemo(() => {
    const groups = []
    steps.forEach((step, i) => {
      const text = step.chosen.text
      const startsWord = groups.length === 0 || text.startsWith(' ') || text.startsWith('\n')
      if (startsWord) groups.push({ start: i, members: [] })
      groups[groups.length - 1].members.push({ step, i })
    })
    return groups
  }, [steps])

  if (collapsed) {
    return (
      <div style={{ ...shell, padding: '6px 10px', gap: 'var(--space-sm)' }}>
        <IconButton label={playing ? 'Pause' : 'Play'} onClick={toggle}>
          {playing
            ? <Pause size={15} strokeWidth={1.8} aria-hidden="true" />
            : <Play size={15} strokeWidth={1.8} aria-hidden="true" />}
        </IconButton>
        <span className="data" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
          {index + 1}/{total}
        </span>
        <IconButton label="Show the timeline" onClick={onToggleCollapse}>
          <ChevronUp size={15} strokeWidth={1.8} aria-hidden="true" />
        </IconButton>
      </div>
    )
  }

  return (
    <div style={shell}>
      <IconButton label="Back to the first token" onClick={restart}>
        <ChevronsLeft size={16} strokeWidth={1.8} aria-hidden="true" />
      </IconButton>
      <IconButton label={playing ? 'Pause' : 'Play'} onClick={toggle}>
        {playing
          ? <Pause size={17} strokeWidth={1.8} aria-hidden="true" />
          : <Play size={17} strokeWidth={1.8} aria-hidden="true" />}
      </IconButton>

      <div ref={strip} style={timelineStrip} role="group" aria-label="Generated tokens">
        {words.map((word) => (
          <span key={word.start} style={wordGroup}>
            {word.members.map(({ step, i }, position) => {
              const state = i === index ? 'current' : i < index ? 'past' : 'ahead'
              const first = position === 0
              const last = position === word.members.length - 1
              return (
                <button
                  key={step.step}
                  type="button"
                  onClick={() => seek(i)}
                  data-current={i === index}
                  aria-current={i === index ? 'step' : undefined}
                  title={`step ${i + 1} — ${JSON.stringify(step.chosen.text)} (${step.chosen.prob.toFixed(4)})`}
                  className="token timeline-cell"
                  style={{
                    ...cell,
                    ...cellState[state],
                    // Fragments of one word butt together into a single word-shaped block: only
                    // the outer edges are rounded, and there is no gap between members.
                    borderTopLeftRadius: first ? 'var(--radius-sm)' : 0,
                    borderBottomLeftRadius: first ? 'var(--radius-sm)' : 0,
                    borderTopRightRadius: last ? 'var(--radius-sm)' : 0,
                    borderBottomRightRadius: last ? 'var(--radius-sm)' : 0,
                    paddingLeft: first ? '7px' : '1px',
                    paddingRight: last ? '7px' : '1px',
                  }}
                >
                  {/* The leading space is dropped here and carried by the gap between words
                      instead. Elsewhere it stays visible as `·`, because in the candidate list the
                      difference between `cat` and `·cat` is two different tokens with two
                      different probabilities. Here the strip's job is to read as the sentence. */}
                  {step.chosen.text.replace(/^ /, '').replace(/\n/g, '⏎') || '·'}
                </button>
              )
            })}
          </span>
        ))}
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

      <IconButton label="Hide the timeline" onClick={onToggleCollapse}>
        <ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" />
      </IconButton>
    </div>
  )
}

function IconButton({ children, label, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="icon-control" style={iconButton}>
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

const wordGroup = { display: 'flex', flex: '0 0 auto' }

const cell = {
  // No shrinking and no width floor now that fragments are grouped: a word is exactly as wide as
  // its letters, so the strip reads as a sentence rather than a row of equal boxes. Past the
  // available width it scrolls.
  flex: '0 0 auto',
  border: 'none',
  minWidth: '24px',
  minHeight: '28px',
  padding: '4px 7px',
  fontSize: '12px',
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
  ahead: {
    background: 'color-mix(in oklab, var(--surface-raised) 55%, transparent)',
    color: 'var(--text-muted)',
  },
}

const iconButton = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  flex: 'none',
  background: 'none',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: 0,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  lineHeight: 1,
}

const speedSelect = {
  background: 'var(--surface-raised)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-hair)',
  borderRadius: 'var(--radius-sm)',
  minHeight: '28px',
  padding: '3px 6px',
  fontSize: '12px',
}
