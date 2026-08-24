import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import fixture from '../fixtures/steps.sample.json'

/**
 * A run: either live from the model, or the committed recording.
 *
 * This replaces useSteps and is the ONLY file M5 needed to change. Everything downstream reads
 * `steps` and renders `steps[index]`, exactly as it did against the fixture -- which was the whole
 * point of building the frontend against a frozen schema first. If anything else had needed
 * changing here, that would have been the bug.
 *
 * The socket stays open across runs. Events are appended to `steps` as they arrive; the playback
 * controller walks its own index through them on its own clock. At ~32 tokens/second the backend
 * finishes an answer in about a second and a half, so without that separation the run would be
 * over before a human registered it.
 *
 * FALLBACK, and it is labelled: with no backend reachable the app serves the committed fixture
 * rather than an empty room. That recording is itself real -- it came out of the same model
 * through run_local.py -- but it is a recording, and `source` says so plainly so the interface can
 * never imply a model is running when one is not.
 */

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const WS_URL = `${API.replace(/^http/, 'ws')}/ws`

const fixtureSteps = fixture.filter((event) => event.type === 'step')
const fixtureDone = fixture.find((event) => event.type === 'done') ?? null

function promptFrom(steps) {
  // The prompt is not a field on the wire. It is recoverable from the context, which flags every
  // position the chat template added; what is left is exactly what the visitor typed.
  return (
    steps[0]?.context
      .filter((position) => !position.is_template)
      .map((position) => position.text)
      .join('') ?? ''
  )
}

export function useRun() {
  const socket = useRef(null)
  const [connection, setConnection] = useState('connecting')  // connecting | waking | offline | live
  const [steps, setSteps] = useState(fixtureSteps)
  const [done, setDone] = useState(fixtureDone)
  const [error, setError] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(null)
  // Whether what is on screen came from the socket this session, rather than inferring it from
  // connection state -- being connected is not the same as having run anything.
  const [isLive, setIsLive] = useState(false)

  // Is the model in memory yet? Re-checked whenever the socket comes up, NOT once at mount: on a
  // sleeping host the first check fails, and a stale `null` from that attempt used to let the UI
  // claim "connected and loaded" about a container that had loaded nothing.
  useEffect(() => {
    if (connection !== 'live') return undefined
    let cancelled = false
    fetch(`${API}/health`)
      .then((res) => res.json())
      .then((health) => !cancelled && setModelLoaded(Boolean(health.loaded)))
      .catch(() => !cancelled && setModelLoaded(null))
    return () => { cancelled = true }
  }, [connection])

  // RECONNECT WITH BACKOFF -- required, not defensive.
  //
  // The deploy target scales to zero, so the normal first visit finds the container asleep and the
  // very first socket attempt fails while it boots. A single attempt would leave the app
  // permanently 'offline' until someone thought to reload, which is exactly the visitor who has
  // already left. Retrying makes the cold start a wait instead of a dead end.
  useEffect(() => {
    let ws
    let timer
    let attempt = 0
    let closed = false

    // After this many failures, stop saying "waking" and say "offline" instead -- while still
    // retrying. A sleeping cloud container answers within a few attempts; a laptop with no backend
    // running never will, and telling that visitor to start the server beats an eternal spinner.
    const WAKING_ATTEMPTS = 5

    const connect = () => {
      if (closed) return
      if (attempt === 0) setConnection('connecting')
      else if (attempt < WAKING_ATTEMPTS) setConnection('waking')
      else setConnection('offline')

      try {
        ws = new WebSocket(WS_URL)
      } catch {
        schedule()
        return
      }

      ws.onopen = () => {
        attempt = 0
        setConnection('live')
      }

      ws.onclose = () => {
        setGenerating(false)
        schedule()
      }

      ws.onerror = () => {}   // onclose always follows; retrying twice would halve the backoff

      ws.onmessage = (message) => {
        const event = JSON.parse(message.data)
        if (event.type === 'step') {
          setSteps((current) => [...current, event])
        } else if (event.type === 'done') {
          setDone(event)
          setGenerating(false)
          setModelLoaded(true)
        } else if (event.type === 'error') {
          setError(event.message)
          setGenerating(false)
        }
      }

      socket.current = ws
    }

    const schedule = () => {
      if (closed) return
      // 1s, 2s, 4s, then every 8s. A cold container takes tens of seconds; hammering it while it
      // boots helps nobody.
      const delay = Math.min(1000 * 2 ** attempt, 8000)
      attempt += 1
      timer = setTimeout(connect, delay)
    }

    connect()
    return () => {
      closed = true
      clearTimeout(timer)
      ws?.close()
    }
  }, [])

  const start = useCallback((prompt, maxTokens = 60) => {
    const ws = socket.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('Not connected to the model.')
      return false
    }
    setSteps([])          // a new run replaces the old one; the timeline is one answer, not a log
    setDone(null)
    setIsLive(true)
    setError(null)
    setGenerating(true)
    ws.send(JSON.stringify({ prompt, max_tokens: maxTokens }))
    return true
  }, [])

  return useMemo(
    () => ({
      steps,
      done,
      error,
      generating,
      connection,
      modelLoaded,
      source: isLive ? 'live' : 'fixture',
      prompt: promptFrom(steps),
      start,
    }),
    [steps, done, error, generating, connection, modelLoaded, isLive, start],
  )
}
