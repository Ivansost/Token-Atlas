import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

import { dampingAmount } from '../lib/motion'

/**
 * Keeps the chosen token in view as the run advances.
 *
 * Without this the camera stays where you left it while the amber token jumps to each new word's
 * real coordinate -- and since those coordinates are genuinely far apart (`Paris` and `The` sit 38
 * units from each other), the subject of the scene repeatedly walks out of frame.
 *
 * It moves the ORBIT TARGET, not the camera. The viewer keeps whatever angle and distance they
 * chose; the room simply re-centres on the token under discussion. Moving the camera itself would
 * override a deliberate act by the viewer -- the difference between following and yanking.
 *
 * The move is a slow lerp because the motion grammar of this world is easing; nothing snaps.
 */
export function FollowChosen({ position, enabled = true }) {
  const controls = useThree((state) => state.controls)
  const camera = useThree((state) => state.camera)
  const goal = useRef(new THREE.Vector3())
  const delta = useRef(new THREE.Vector3())

  useFrame((_, elapsed) => {
    if (!enabled || !position || !controls?.target) return

    goal.current.set(position[0], position[1], position[2])

    // Move the camera BY THE SAME DELTA as the target, rather than only moving the target.
    // Moving the target alone changes the camera-to-target distance every time the token jumps,
    // so the sphere swells or shrinks depending on which direction the next word happens to live
    // in -- apparent size stops meaning probability and starts meaning "how far the camera
    // drifted". Translating both preserves the viewer's distance and angle exactly.
    // Exponential damping is time-based, so the same move takes the same time at 30, 60 or 120 Hz.
    // 2.76/s matches the old 4.5% step at 60 Hz without tying motion to the display refresh rate.
    const amount = dampingAmount(elapsed)
    delta.current.subVectors(goal.current, controls.target).multiplyScalar(amount)
    controls.target.add(delta.current)
    camera.position.add(delta.current)
    controls.update()
  })

  return null
}
