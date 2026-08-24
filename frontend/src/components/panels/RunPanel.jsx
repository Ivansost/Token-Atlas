/**
 * Run: where a visitor will type their own prompt.
 *
 * It is honestly disabled until M5. The model runs on the backend and this build is playing a
 * committed recording of a real run -- so the panel says exactly that rather than offering an
 * input that silently does nothing, which would be the first dishonest thing in the interface.
 */
export function RunPanel({ prompt, done }) {
  return (
    <>
      <div>
        <label htmlFor="prompt" style={label}>Prompt</label>
        <textarea id="prompt" rows={3} value={prompt} readOnly style={textarea} />
      </div>

      <p style={note}>
        Typing your own prompt arrives at M5, when this connects to the running model. Right now
        the interface is playing a recording of a real run — every probability, attention weight
        and coordinate on screen came from an actual forward pass, but the run already happened.
      </p>

      {done && (
        <dl style={grid}>
          <dt style={dt}>Answer</dt>
          <dd style={dd} className="token">{done.text}</dd>
          <dt style={dt}>Tokens</dt>
          <dd style={dd} className="data">{done.steps}</dd>
          <dt style={dt}>Generated in</dt>
          <dd style={dd} className="data">{done.elapsed_s}s</dd>
          <dt style={dt}>Stopped on</dt>
          <dd style={dd} className="data">{done.stop_reason}</dd>
        </dl>
      )}

      <p style={note}>
        The model is <span className="data">Qwen2.5-0.5B-Instruct</span>, 494 million parameters,
        running on CPU with eager attention — the slow implementation, because the fast ones never
        build the attention matrix this project exists to show.
      </p>
    </>
  )
}

const label = { display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }

const textarea = {
  width: '100%',
  background: 'var(--surface-raised)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-hair)',
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--space-sm)',
  font: 'inherit',
  fontSize: '12.5px',
  resize: 'none',
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
const note = { margin: 0, fontSize: '11.5px', lineHeight: 1.55, color: 'var(--text-muted)' }
