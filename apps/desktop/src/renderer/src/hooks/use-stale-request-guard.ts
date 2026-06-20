import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns a stable checker for in-flight async work.
 * Bumps generation when `deps` change so older responses are ignored.
 */
export function useStaleRequestGuard(deps: ReadonlyArray<unknown>): () => () => boolean {
  const generationRef = useRef(0)

  useEffect(() => {
    generationRef.current += 1
  }, [...deps])

  return useCallback(() => {
    const generation = generationRef.current
    return () => generation === generationRef.current
  }, [])
}
