import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useMemo } from 'react'

import { buildAtlasSpace, expandField, makeProjector } from '../lib/atlasSpace'

const BLOOM_ENABLED = false

import { toHex } from '../design/color'
import { scene as sceneDefaults, theme } from '../design/tokens'
import { FollowChosen } from './FollowChosen'
import { LiveLayer } from './LiveLayer'
import { Trail } from './Trail'
import { VocabField } from './VocabField'

/**
 * The room.
 *
 * The page ground and the scene ground are the same colour on purpose: the
 * interface has no edge, and the chrome floats over a space rather than sitting beside a widget.
 *
 * Depth is carried by exponential fog and by scale -- never by shadows. There is no light in this
 * scene and nothing that needs one: points are unlit material, so the far edge of the vocabulary
 * dissolves into voidDeep instead of ending at a visible boundary.
 */
export function Scene({ field, fieldOpacity, fieldSize, step, follow, nucleus, stride, tint, spread = 0, selected, hoveredId, onSelect, steps = [], index = 0, drift = true, bloom = false }) {
  /**
   * The spread transform, built once from the field and applied to EVERY layer.
   *
   * One table, one projector, three consumers. The field buffer is transformed in bulk; the live
   * layer and the trail get a per-point function, because between them they draw a couple of
   * hundred points a frame rather than 151,665. What matters is that they all use the same
   * mapping -- a candidate drawn in one space over a field drawn in another would put tokens
   * beside neighbours they do not have, which is the one lie this scene cannot afford.
   */
  const space = useMemo(
    () => (field.status === 'ready' ? buildAtlasSpace(field.positions, field.count) : null),
    [field.status, field.positions, field.count],
  )
  const drawn = useMemo(
    () => (space ? expandField(field.positions, field.count, space, spread) : field.positions),
    [space, field.positions, field.count, spread],
  )
  const project = useMemo(() => makeProjector(space, spread), [space, spread])

  return (
    <Canvas
      role="img"
      aria-label="Interactive 3D map of the model's vocabulary"
      aria-describedby="scene-description"
      camera={{ position: sceneDefaults.cameraStart, fov: 55, near: 0.5, far: 2000 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      // Points need a pick radius in world units; without one a click on a 2px dot never hits.
      // The pick radius is in WORLD units, so it has to grow with the atlas: after the spread
      // transform the same dot occupies the same pixels but sits in a much larger space, and a
      // fixed 1.1 threshold would make the field effectively unclickable.
      raycaster={{ params: { Points: { threshold: 1.1 + 2.4 * spread } } }}
      onPointerMissed={() => onSelect?.(null)}
      style={{ background: theme.color.void }}
    >
      <fogExp2 attach="fog" args={[toHex(theme.color.voidDeep), sceneDefaults.fogDensity]} />

      {field.status === 'ready' && (
        <VocabField
          positions={drawn}
          raw={field.positions}
          count={field.count}
          opacity={fieldOpacity}
          size={fieldSize ?? sceneDefaults.fieldPointSize}
          stride={stride}
          tint={tint}
          onSelect={onSelect}
        />
      )}

      <Trail steps={steps} index={index} project={project} />

      <LiveLayer step={step} nucleus={nucleus} selectedId={selected?.id} hoveredId={hoveredId} onSelect={onSelect} project={project} />
      <FollowChosen position={step?.chosen?.pos3d && project(step.chosen.pos3d)} enabled={follow} />

      {/*
        Bloom. The one purely visual effect in the project, and the only thing on screen that adds
        nothing to the data. It earns its place by making dense regions bleed light, so brightness
        reads as density -- and by giving the chosen token the presence a 12-pixel disc cannot have
        on its own. Threshold is high so only genuinely bright accumulations glow; lower values lit
        the entire field and flattened everything into one pale wash.
      */}
      {BLOOM_ENABLED && (
        <EffectComposer>
          <Bloom intensity={0.7} luminanceThreshold={0.5} luminanceSmoothing={0.4} mipmapBlur />
        </EffectComposer>
      )}

      {/* The camera glides; nothing snaps. Damping is the motion grammar of this world. */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.5}
        // Fast enough that one gesture crosses a real distance: the cloud spans ~120 units and
        // the interesting structure is inside the core, so a slow dolly makes it feel stuck.
        zoomSpeed={1.8}
        panSpeed={0.5}
        minDistance={sceneDefaults.minDistance}
        maxDistance={620}
        // Zoom slows as you close in, so the last few units into a cluster are controllable
        // instead of overshooting straight through it.
        zoomToCursor
        // A slow constant orbit when nobody is driving. A still 3D scene reads as a screenshot;
        // the parallax of drifting past 151,665 points is what tells the eye it has depth at all.
        // It stops the moment the visitor touches the controls, and never fights an input.
        autoRotate={drift}
        autoRotateSpeed={0.12}
      />
    </Canvas>
  )
}
