import { useMemo } from 'react'

import fixture from '../fixtures/steps.sample.json'

/**
 * The run: one step event per generated token.
 *
 * At M4 this reads a committed fixture so the whole interface can be built and judged with the
 * model switched off -- iterating on visual language is roughly ten times faster without a
 * backend in the loop, and it forces the frontend to depend only on the frozen schema.
 *
 * The fixture is NOT hand-written. It was produced by running the real model through
 * `backend/scripts/run_local.py --json`, so every probability, attention weight and coordinate in
 * it came out of a genuine forward pass. Building the UI against invented numbers would have let
 * a shape through that real data does not have -- a tidy distribution, a plausible-looking
 * attention row -- and the first thing M5 would have discovered is that reality is untidier.
 *
 * At M5 this hook swaps its source for the WebSocket. Nothing else in the UI should need to
 * change, and if something does, that is the bug.
 */
export function useSteps() {
  return useMemo(() => {
    const steps = fixture.filter((event) => event.type === 'step')
    const done = fixture.find((event) => event.type === 'done') ?? null
    return { status: 'ready', steps, done, source: 'fixture' }
  }, [])
}
