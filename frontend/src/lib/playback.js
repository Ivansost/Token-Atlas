import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Playback. One integer and a timer.
 *
 * This is the design idea the whole replay feature rests on: the UI renders `steps[index]`, and a
 * controller walks `index` forward on its own clock. Pause stops the clock. Speed changes the
 * interval. Scrub sets the index. Replay sets it to zero. None of it touches generation.
 *
 * It also turned out to be the ONLY thing that makes the run watchable. Generation measured ~32
 * tokens/second at M0, so a whole answer lands in about a second and a half -- if the scene
 * rendered events as they arrived it would be over before a human registered it. The backend
 * cannot pace this; the frontend has to.
 *
 * Nothing here is a simulation. Every index points at a real recorded forward pass.
 */

export const SPEEDS = [0.5, 1, 2, 4]
const BASE_STEP_MS = 700

export function usePlayback(count) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const timer = useRef(null)

  const atEnd = index >= count - 1

  useEffect(() => {
    if (!playing || count === 0) return undefined

    timer.current = setInterval(() => {
      setIndex((current) => {
        if (current >= count - 1) {
          setPlaying(false)          // stop at the end rather than looping; a loop hides the end
          return current
        }
        return current + 1
      })
    }, BASE_STEP_MS / speed)

    return () => clearInterval(timer.current)
  }, [playing, speed, count])

  const play = useCallback(() => {
    // Pressing play at the end replays from the start, which is what the button appears to promise.
    setIndex((current) => (current >= count - 1 ? 0 : current))
    setPlaying(true)
  }, [count])

  const pause = useCallback(() => setPlaying(false), [])
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, play, pause])

  const restart = useCallback(() => {
    setPlaying(false)
    setIndex(0)
  }, [])

  const seek = useCallback((next) => {
    setPlaying(false)               // scrubbing takes over; it does not fight the timer
    setIndex(Math.max(0, Math.min(next, count - 1)))
  }, [count])

  return { index, playing, speed, atEnd, play, pause, toggle, restart, seek, setSpeed }
}
