import { useCallback, useEffect, useState } from 'react'

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
      .then((tokens) => {
        cache = tokens
        return tokens
      })
      .catch(() => {
        cache = []
        return cache
      })
  }
  return inflight
}

export function useVocabTokens({ enabled }) {
  const [tokens, setTokens] = useState(cache)

  useEffect(() => {
    if (!enabled || tokens) return
    let cancelled = false
    load().then((loaded) => {
      if (!cancelled) setTokens(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, tokens])

  const textFor = useCallback((id) => tokens?.[id] ?? null, [tokens])

  return { tokens, textFor, ready: Boolean(tokens?.length) }
}
