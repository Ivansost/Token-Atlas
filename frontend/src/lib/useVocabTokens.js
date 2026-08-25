import { useCallback, useEffect, useState } from 'react'

import { validateTokenList } from './vocabData'

/**
 * The text of every token, indexed the same way as the coordinates.
 *
 * Loaded lazily and only once someone actually interacts, because it is 1.59 MB of strings that a
 * visitor who never clicks anything does not need. The field renders from the coordinate buffer
 * alone; this is what lets a click answer "what is that?" instead of returning an index.
 */

const URL = `${import.meta.env.BASE_URL}data/vocab_tokens.json`

let cache = null
let inflight = null

function load() {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch(URL)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then(validateTokenList)
      .then((tokens) => {
        cache = tokens
        return tokens
      })
      .finally(() => { inflight = null })
  }
  return inflight
}

export function useVocabTokens({ enabled }) {
  const [tokens, setTokens] = useState(cache)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    cache = null
    inflight = null
    setTokens(null)
    setError(null)
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    if (cache) return undefined
    let cancelled = false
    load()
      .then((loaded) => {
        if (cancelled) return
        setTokens(loaded)
      })
      .catch((reason) => {
        if (cancelled) return
        setError(reason.message)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, attempt])

  const textFor = useCallback((id) => tokens?.[id] ?? null, [tokens])
  const status = tokens ? 'ready' : error ? 'error' : enabled ? 'loading' : 'idle'

  return { tokens, textFor, ready: Boolean(tokens), status, error, retry }
}
