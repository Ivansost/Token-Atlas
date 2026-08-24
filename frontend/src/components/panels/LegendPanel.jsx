/**
 * Legend: what the scene means, and what it does not.
 *
 * This is content, not fine print, and it may not be polished away for a cleaner look.
 * The project's whole claim is that nothing on screen is faked; a claim like that is only worth
 * anything if the limits are stated as plainly as the features.
 *
 * The framing rule in particular is load-bearing. Attention says which earlier positions this one
 * weighted most heavily. It does NOT say why the model chose the word, and the measurements back
 * that up: 42-73% of every step's attention lands on chat-template scaffolding, and in the M1
 * probe the semantically decisive token ranked fourth at 4.5%.
 */
export function LegendPanel() {
  return (
    <>
      <Entry swatch="var(--chosen)" title="Chosen token">
        The token the model actually emitted. This colour means nothing else anywhere in the
        interface.
      </Entry>

      <Entry swatch="var(--candidate)" title="Candidate">
        A token it considered. Diameter and bar length scale with the square root of probability,
        so a 73% winner does not erase a 0.9% also-ran.
      </Entry>

      <Entry swatch="var(--attention)" title="Attention link">
        Drawn from the chosen token back to the earlier positions it weighted most heavily.
        Thickness and opacity both carry weight.
      </Entry>

      <Entry swatch="var(--field)" title="The vocabulary">
        All 151,665 tokens the model knows, at fixed positions from a UMAP projection of its own
        embeddings. Ambient, deliberately dim, and clickable.
      </Entry>

      <div style={rule}>
        <h3 style={h3}>The attention rule</h3>
        <p style={body}>
          Last layer, averaged across all 14 heads, top 5 earlier positions. One rule, no layer or
          head selector. The model computed 24 × 14 = 336 attention grids per token; this collapses
          them to one.
        </p>
      </div>

      <div style={rule}>
        <h3 style={h3}>What attention does not mean</h3>
        <p style={body}>
          It shows <em>which earlier tokens this position weighted most heavily</em> — never{' '}
          <em>why the model chose this word</em>. Measured on this model: 42–73% of each step’s
          attention lands on chat-template scaffolding the visitor never typed, and when predicting
          “Paris” the token “France” ranked fourth at 4.5%.
        </p>
      </div>

      <div style={rule}>
        <h3 style={h3}>How honest the positions are</h3>
        <p style={body}>
          The projection keeps 77.7% of each token’s nearest neighbours nearby — measured, against
          1% for random placement. It is meaningfully semantic, not perfectly so: <span className="token">Paris</span>,{' '}
          <span className="token">London</span> and <span className="token">巴黎</span> sit within one unit of each
          other, while <span className="token">The</span> is 38 away.
        </p>
      </div>
    </>
  )
}

function Entry({ swatch, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
      <span style={{ ...dot, background: swatch }} />
      <div>
        <h3 style={h3}>{title}</h3>
        <p style={body}>{children}</p>
      </div>
    </div>
  )
}

const dot = { width: '9px', height: '9px', borderRadius: '50%', flex: 'none', marginTop: '5px' }
const h3 = { margin: 0, fontSize: '12.5px', fontWeight: 400, color: 'var(--text-primary)' }
const body = { margin: '2px 0 0', fontSize: '11.5px', lineHeight: 1.55, color: 'var(--text-muted)' }
const rule = { borderTop: '1px solid var(--border-hair)', paddingTop: 'var(--space-md)' }
