import { Crosshair, Info, ListOrdered, Play, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ConnectionStatus } from './components/ConnectionStatus'
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

/** Rail, one attached panel, the scene, and a floating transport. Nothing on the right. */
export default function DesktopApp({ reducedMotion = false }) {
  const field = useVocabField()
  const run = useRun()
  const playback = usePlayback(run.steps.length)

  // Running a prompt is the primary task, so it is visible on arrival rather than hidden behind
  // an icon that a first-time visitor has to discover.
  const [panel, setPanel] = useState('run')
  const [collapsed, setCollapsed] = useState(false)
  const [selected, setSelected] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [maxTokens, setMaxTokens] = useState(60)
  const [settings, setSettings] = useState(() => ({
    fieldOpacity: sceneDefaults.fieldOpacity,
    fieldSize: sceneDefaults.fieldPointSize,
    stride: 1,
    tint: 0.7,
    spread: sceneDefaults.spread,
    nucleus: 0.99,
    follow: !reducedMotion,
  }))

  const vocab = useVocabTokens({ enabled: Boolean(selected) })
  const step = run.steps[playback.index] ?? null

  const wasGenerating = useRef(false)
  useEffect(() => {
    if (run.generating && !wasGenerating.current) {
      playback.restart()
      setSelected(null)
    }
    if (!run.generating && wasGenerating.current && run.steps.length > 0 && !reducedMotion) {
      playback.play()
    }
    wasGenerating.current = run.generating
  }, [run.generating, run.steps.length, playback, reducedMotion])

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
              key={step?.step ?? 'empty'}
              step={step}
              nucleus={settings.nucleus}
              hoveredId={hoveredId}
              selectedId={selected?.id}
              onHover={setHoveredId}
              onSelect={setSelected}
              reducedMotion={reducedMotion}
            />
          )}
          {panel === 'selection' && (
            <SelectionPanel selection={selected} step={step} textFor={vocab.textFor} />
          )}
          {panel === 'display' && (
            <DisplayPanel
              settings={settings}
              onChange={setSettings}
              tokenCount={field.count}
              reducedMotion={reducedMotion}
            />
          )}
          {panel === 'legend' && <LegendPanel />}
        </Panel>
      )}

      <main style={stage} aria-label="Token visualization">
        <h1 className="sr-only">Token Atlas — watch a language model choose each word</h1>
        <p id="scene-description" className="sr-only">
          An interactive 3D map of the model’s vocabulary. Use the Candidates panel for a
          keyboard-accessible list of tokens in the current decision.
        </p>

        <Scene
          field={field}
          fieldOpacity={settings.fieldOpacity}
          fieldSize={settings.fieldSize}
          stride={settings.stride}
          tint={settings.tint}
          spread={settings.spread}
          nucleus={settings.nucleus}
          follow={settings.follow && !reducedMotion}
          step={step}
          selected={selected}
          hoveredId={hoveredId}
          onSelect={select}
          steps={run.steps}
          index={playback.index}
          drift={!playback.playing}
        />

        <ConnectionStatus run={run} />

        {run.steps.length > 0 && (
          <Transport
            steps={run.steps}
            playback={playback}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((value) => !value)}
            reducedMotion={reducedMotion}
          />
        )}
      </main>
    </div>
  )
}

const shell = { display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }

// The transport is absolutely positioned inside the stage. Clipping here keeps a long timeline
// inside its own scroll region instead of widening the document and pushing the rail away.
const stage = { position: 'relative', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }
