import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'

import { toHex } from '../design/color'
import { scene as sceneDefaults, theme } from '../design/tokens'
import { LiveLayer } from './LiveLayer'
import { VocabField } from './VocabField'

/**
 * The room.
 *
 * Per DESIGN.md the page ground and the scene ground are the same colour on purpose: the
 * interface has no edge, and the chrome floats over a space rather than sitting beside a widget.
 *
 * Depth is carried by exponential fog and by scale -- never by shadows. There is no light in this
 * scene and nothing that needs one: points are unlit material, so the far edge of the vocabulary
 * dissolves into voidDeep instead of ending at a visible boundary.
 */
export function Scene({ field, fieldOpacity, fieldSize, step }) {
  return (
    <Canvas
      camera={{ position: sceneDefaults.cameraStart, fov: 55, near: 0.5, far: 2000 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ background: theme.color.void }}
    >
      <fogExp2 attach="fog" args={[toHex(theme.color.voidDeep), sceneDefaults.fogDensity]} />

      {field.status === 'ready' && (
        <VocabField
          positions={field.positions}
          count={field.count}
          opacity={fieldOpacity}
          size={fieldSize ?? sceneDefaults.fieldPointSize}
        />
      )}

      <LiveLayer step={step} />

      {/* The camera glides; nothing snaps. Damping is the motion grammar of this world. */}
      <OrbitControls
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
      />
    </Canvas>
  )
}
