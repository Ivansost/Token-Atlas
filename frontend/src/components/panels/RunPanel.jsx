import { useState } from 'react'

// Chosen from MODEL_NOTES.md, where every prompt was tested against this model. Each shows
// something different, and the third is here precisely because the model gets it wrong.
const PRESETS = [
  { text: 'What is the capital of France?', why: 'a real decision — 11 tokens hold 99%' },
  { text: 'What is 17 times 23?', why: 'digits are separate tokens, and it still gets it right' },
  { text: 'What type is Mudkip?', why: 'confidently invents an answer' },
]

/**
 * Run: type a prompt, watch the model answer it.
 *
 * The status line is the honest part. Three states matter and each says something different:
 *
 *   offline    no backend reachable, and the scene is playing a committed recording. Said plainly,
 *              because an interface implying a model is running when none is would be the first
 *              faked thing here.
 *   cold       connected, but the model is not in memory yet. A container spends ~27s loading a
 *              gigabyte of weights, measured at M0, and that wait is the single worst moment in
 *              the product. It gets named rather than hidden behind a spinner.
 *   generating the model is producing tokens right now.
 */
export function RunPanel({ run, maxTokens, onMaxTokens }) {
  const [draft, setDraft] = useState(run.prompt || PRESETS[0].text)

  const connected = run.connection === 'live'
  const canRun = connected && !run.generating && draft.trim().length > 0

  const submit = (event) => {
    event.preventDefault()
    if (canRun) run.start(draft.trim(), maxTokens)
  }

  return (
    <>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        <label htmlFor="prompt" style={label}>Prompt</label>
        <textarea
          id="prompt"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit(event)
          }}
          placeholder="Ask the model something"
          style={textarea}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <label htmlFor="max-tokens" style={{ ...label, marginBottom: 0 }}>Length</label>
          <input
            id="max-tokens" type="range" min={10} max={120} step={5}
            value={maxTokens} onChange={(event) => onMaxTokens(Number(event.target.value))}
            style={{ flex: 1, accentColor: 'var(--candidate)' }}
          />
          <span className="data" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            {maxTokens}
          </span>
        </div>

        <button type="submit" disabled={!canRun} style={{ ...button, opacity: canRun ? 1 : 0.5 }}>
          {run.generating ? 'Generating…' : 'Run'}
        </button>
      </form>

      <Status run={run} />

      <div>
        <span style={label}>Try</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {PRESETS.map((preset) => (
            <button key={preset.text} type="button" style={presetButton}
              onClick={() => {
                setDraft(preset.text)
                if (connected && !run.generating) run.start(preset.text, maxTokens)
              }}>
              <span style={{ color: 'var(--text-secondary)' }}>{preset.text}</span>
              <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '10.5px' }}>
                {preset.why}
              </span>
            </button>
          ))}
        </div>
      </div>

      {run.done && (
        <dl style={grid}>
          <dt style={dt}>Answer</dt>
          <dd style={dd} className="token">{run.done.text}</dd>
          <dt style={dt}>Tokens</dt>
          <dd style={dd} className="data">{run.done.steps}</dd>
          <dt style={dt}>Generated in</dt>
          <dd style={dd} className="data">{run.done.elapsed_s}s</dd>
          <dt style={dt}>Stopped on</dt>
          <dd style={dd} className="data">{run.done.stop_reason}</dd>
        </dl>
      )}

      <p style={note}>
        The model is <span className="data">Qwen2.5-0.5B-Instruct</span>, 494 million parameters, on
        CPU with eager attention — the slow implementation, because the fast ones never build the
        attention matrix this project exists to show.
      </p>
    </>
  )
}

function Status({ run }) {
  if (run.error) {
    return <p style={{ ...note, color: 'var(--attention)' }}>{run.error}</p>
  }

  if (run.connection === 'connecting') {
    return <p style={note}>Connecting to the model…</p>
  }

  if (run.connection === 'waking') {
    return <p style={note}>Waking the model — the server sleeps when idle. Retrying…</p>
  }

  if (run.connection === 'offline') {
    return (
      <p style={note}>
        <strong style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>No model connected.</strong>{' '}
        The scene is playing a committed recording of a real run — every number in it came from an
        actual forward pass, but it already happened. Start the backend with{' '}
        <span className="data">uvicorn app.main:app</span> to run your own prompts.
      </p>
    )
  }

  if (run.generating) {
    return <p style={note}>Generating — <span className="data">{run.steps.length}</span> tokens so far.</p>
  }

  if (run.modelLoaded === false) {
    return (
      <p style={note}>
        Connected. The model is not in memory yet — the first run loads 494 million weights. They
        ship with the server rather than being downloaded, so it is quick, and every run after it
        is immediate.
      </p>
    )
  }

  // Only claims "loaded" when the server actually said so. `modelLoaded` is null when the health
  // check has not succeeded, and claiming a loaded model on the strength of an open socket is the
  // kind of small untruth this project does not get to make.
  return (
    <p style={note}>
      {run.modelLoaded === true ? 'Connected and loaded.' : 'Connected.'}{' '}
      {run.source === 'fixture' && 'Showing a recording until you run something.'}
    </p>
  )
}

const label = { display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }

const textarea = {
  width: '100%',
  background: 'var(--surface-raised)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-hair)',
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--space-sm)',
  font: 'inherit',
  fontSize: '12.5px',
  resize: 'vertical',
}

const button = {
  background: 'var(--surface-raised)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-hair)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 10px',
  font: 'inherit',
  fontSize: '12.5px',
  cursor: 'pointer',
}

const presetButton = {
  background: 'none',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '3px 4px',
  color: 'var(--text-muted)',
  font: 'inherit',
  fontSize: '11.5px',
  textAlign: 'left',
  cursor: 'pointer',
}

const grid = {
  display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px var(--space-md)', margin: 0, fontSize: '12px',
}
const dt = { color: 'var(--text-muted)' }
const dd = { margin: 0, color: 'var(--text-secondary)', textAlign: 'right', overflowWrap: 'anywhere' }
const note = { margin: 0, fontSize: '11.5px', lineHeight: 1.55, color: 'var(--text-muted)' }
