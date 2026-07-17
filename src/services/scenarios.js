// Helpers for injecting the active character scenario into API payloads.
//
// A scenario injects only when it is the single "active" entry and has
// non-empty content. Injection is stateless: each API call re-evaluates the
// active scenario's lifetime against the current thread state:
//   - 'oneTime'      → only on the very first message of the thread
//   - 'firstSummary' → until (and including) the first summarization event,
//                      gated on thread.lastSummarizationAt being null
//   - 'always'       → on every call

export function getActiveScenario(character) {
  const scenarios = character?.scenarios
  if (!Array.isArray(scenarios)) return null
  const active = scenarios.find((s) => s?.active)
  if (!active) return null
  const content = (active.content || '').trim()
  if (!content) return null
  return active
}

// Returns the scenario text to inject (already var-substituted by the caller
// is NOT done here — caller passes resolved content) or '' when none applies.
// `lastSummarizationAt` is the thread's value (null before any summary).
export function resolveScenarioInjection(character, { isFirstMessage, lastSummarizationAt }) {
  const scenario = getActiveScenario(character)
  if (!scenario) return ''

  const hasSummary = Boolean(lastSummarizationAt)
  const lifetime = scenario.lifetime || 'firstSummary'

  if (lifetime === 'oneTime') {
    return isFirstMessage ? scenario.content : ''
  }
  if (lifetime === 'firstSummary') {
    return hasSummary ? '' : scenario.content
  }
  // 'always'
  return scenario.content
}
