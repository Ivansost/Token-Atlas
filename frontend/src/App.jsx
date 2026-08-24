import { Crosshair, Info, ListOrdered, Play, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Panel } from './components/Panel'
import { Rail } from './components/Rail'
import { Scene } from './components/Scene'
import { Transport } from './components/Transport'
import { CandidatesPanel } from './components/panels/CandidatesPanel'
import { DisplayPanel } from './components/panels/DisplayPanel'
import { LegendPanel } from './components/panels/LegendPanel'
import { RunPanel } from './components/panels/RunPanel'
import { SelectionPanel } from './components/panels/SelectionPanel'
import { scene as sceneDefaults } from './design/tokens'
import { usePlayback } from './lib/playback'
import { useRun } from './lib/useRun'
import { useVocabField } from './lib/useVocabField'
import { useVocabTokens } from './lib/useVocabTokens'

const PANELS = [
  { id: 'run', label: 'Run', Icon: Play },
  { id: 'candidates', label: 'Candidates', Icon: ListOrdered },
  { id: 'selection', label: 'Selection', Icon: Crosshair },
  { id: 'display', label: 'Display', Icon: SlidersHorizontal },
  { id: 'legend', label: 'Legend', Icon: Info },
]

const TITLES = {
  run: 'Run',
  candidates: 'Candidates',
  selection: 'Selection',
  display: 'Display',
  legend: 'Legend',
}

/**
 * Rail, one attached panel, the scene, and a floating transport. Nothing on the right.
 *
 * The scene is the ground: closing the panel gives it the full width rather than leaving a gap
 * where chrome used to be.
 */
export default function App() {
  const field = useVocabField()
  const run = useRun()
  const playback = usePlayback(run.steps.length)

  const [panel, setPanel] = useState('candidates')
  const [collapsed, setCollapsed] = useState(false)
  const [selected, setSelected] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [maxTokens, setMaxTokens] = useState(60)
  const [settings, setSettings] = useState({
    fieldOpacity: sceneDefaults.fieldOpacity,
    fieldSize: sceneDefaults.fieldPointSize,
    stride: 1,
    nucleus: 0.99,
    follow: true,
  })

  const vocab = useVocabTokens({ enabled: Boolean(selected) })
  const step = run.steps[playback.index] ?? null

  // A live run starts playing itself. Generation finishes in about a second and a half, so
  // without this the visitor presses Run, the answer is already over, and the scene sits on step
  // one until they discover the transport.
  const wasGenerating = useRef(false)
  useEffect(() => {
    if (run.generating && !wasGenerating.current) {
      playback.restart()
      setSelected(null)
    }
    if (!run.generating && wasGenerating.current && run.steps.length > 0) {
      playback.play()
    }
    wasGenerating.current = run.generating
  }, [run.generating, run.steps.length, playback])

  // Selecting something in the scene opens the panel that explains it. Otherwise a click produces
  // a highlight and no information, which is a dead end.
  const select = useCallback((next) => {
    setSelected(next)
    if (next) setPanel('selection')
  }, [])

  return (
    <div style={shell}>
      <Rail panels={PANELS} active={panel} onSelect={setPanel} />

      {panel && (
        <Panel title={TITLES[panel]} onClose={() => setPanel(null)}>
          {panel === 'run' && <RunPanel run={run} maxTokens={maxTokens} onMaxTokens={setMaxTokens} />}
          {panel === 'candidates' && (
            <CandidatesPanel
              step={step}
              nucleus={settings.nucleus}
              hoveredId={hoveredId}
              selectedId={selected?.id}
              onHover={setHoveredId}
              onSelect={setSelected}
            />
          )}
          {panel === 'selection' && (
            <SelectionPanel selection={selected} step={step} textFor={vocab.textFor} />
          )}
          {panel === 'display' && (
            <DisplayPanel settings={settings} onChange={setSettings} tokenCount={field.count} />
          )}
          {panel === 'legend' && <LegendPanel />}
        </Panel>
      )}

      <main style={stage}>
        <h1 className="sr-only">AI Visualizer — watch a language model choose each word</h1>

        <Scene
          field={field}
          fieldOpacity={settings.fieldOpacity}
          fieldSize={settings.fieldSize}
          stride={settings.stride}
          nucleus={settings.nucleus}
          follow={settings.follow}
          step={step}
          selected={selected}
          hoveredId={hoveredId}
          onSelect={select}
        />

        {run.steps.length > 0 && (
          <Transport
            steps={run.steps}
            playback={playback}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((value) => !value)}
          />
        )}
      </main>
    </div>
  )
}

const shell = { display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }

// `overflow: hidden` is load-bearing, not tidiness. The transport is absolutely positioned inside
// the stage, and its intrinsic width (a timeline cell floor times however many tokens, plus the
// controls) can exceed the stage on a narrow viewport. Without clipping, that widens the
// document's scroll area and pushes the rail off the left edge -- the chrome scrolls away while
// the scene stays put. Clipped here, the timeline scrolls inside itself instead.
const stage = { position: 'relative', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }
