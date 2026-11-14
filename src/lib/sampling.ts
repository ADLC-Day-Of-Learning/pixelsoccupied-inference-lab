/**
 * Pure functions for sampling, temperature, top-k, and top-p probability calculations.
 * Used across Play Level 1 and interactive sampling visualizers.
 */

export interface CandidateToken {
  token: string
  logit: number
}

/**
 * Standard fixed candidate tokens and toy logits for Level 1:
 * Prompt: "The capital of France is…"
 * At temperature = 1.0, tokens with original probability >= 5% are:
 * "Paris" (~49.6%), "Lyon" (~22.3%), "Marseille" (~13.5%), and "the" (~7.4%).
 * Tokens with original probability < 5% are:
 * "a" (~3.7%), "located" (~2.0%), "beautiful" (~1.0%), and "known" (~0.5%).
 */
export const DEFAULT_CANDIDATE_TOKENS: CandidateToken[] = [
  { token: "Paris", logit: 2.4 },
  { token: "Lyon", logit: 1.6 },
  { token: "Marseille", logit: 1.1 },
  { token: "the", logit: 0.5 },
  { token: "a", logit: -0.2 },
  { token: "located", logit: -0.8 },
  { token: "beautiful", logit: -1.5 },
  { token: "known", logit: -2.2 },
]

export const PROMPT_TEXT = "The capital of France is…"

/**
 * Calculates softmax probabilities from an array of logits.
 * Temperature scales logits prior to exponentiation (logits[i] / temperature).
 * - As temperature -> 0 (or when temperature <= 1e-5), approaches greedy argmax (1 for max logit, 0 for others).
 * - Temperature = 1 preserves original logit scaling.
 * - Temperature > 1 flattens the distribution towards uniform.
 */
export function softmax(logits: number[], temperature: number = 1.0): number[] {
  if (logits.length === 0) {
    return []
  }

  // Handle greedy decoding (temperature <= 0 or near zero)
  if (temperature <= 1e-5) {
    const maxVal = Math.max(...logits)
    const maxIndices: number[] = []
    logits.forEach((l, idx) => {
      if (Math.abs(l - maxVal) < 1e-9) {
        maxIndices.push(idx)
      }
    })
    const probPerMax = 1 / maxIndices.length
    return logits.map((_, idx) => (maxIndices.includes(idx) ? probPerMax : 0))
  }

  // Temperature scaling with numerical stability shift (subtract max scaled logit)
  const scaled = logits.map((l) => l / temperature)
  const maxScaled = Math.max(...scaled)
  const exps = scaled.map((s) => Math.exp(s - maxScaled))
  const sumExps = exps.reduce((acc, val) => acc + val, 0)

  if (sumExps === 0 || !Number.isFinite(sumExps)) {
    // Graceful fallback to uniform distribution
    return logits.map(() => 1 / logits.length)
  }

  return exps.map((e) => e / sumExps)
}

/**
 * Retains only the top-k highest probability tokens and sets all others to 0.
 * Renormalizes remaining tokens so their sum is 1.0.
 */
export function applyTopK(probs: number[], k: number): number[] {
  if (probs.length === 0) {
    return []
  }

  const effectiveK = Math.max(1, Math.min(probs.length, Math.floor(k)))

  // Sort indices descending by probability value
  const indexed = probs.map((prob, index) => ({ prob, index }))
  indexed.sort((a, b) => b.prob - a.prob)

  const keptIndices = new Set(indexed.slice(0, effectiveK).map((item) => item.index))

  const filtered = probs.map((p, idx) => (keptIndices.has(idx) ? p : 0))
  const sumFiltered = filtered.reduce((acc, p) => acc + p, 0)

  if (sumFiltered === 0) {
    return probs.map((_, idx) => (keptIndices.has(idx) ? 1 / effectiveK : 0))
  }

  return filtered.map((p) => p / sumFiltered)
}

/**
 * Nucleus sampling (top-p): keeps the smallest set of tokens whose cumulative
 * probability mass covers at least p. Sets all other tokens to 0 and renormalizes.
 * Always retains at least the single highest probability token.
 */
export function applyTopP(probs: number[], p: number): number[] {
  if (probs.length === 0) {
    return []
  }

  const clampedP = Math.max(1e-4, Math.min(1.0, p))

  // Sort descending by probability
  const indexed = probs.map((prob, index) => ({ prob, index }))
  indexed.sort((a, b) => b.prob - a.prob)

  const keptIndices = new Set<number>()
  let cumulative = 0

  for (let i = 0; i < indexed.length; i++) {
    keptIndices.add(indexed[i].index)
    cumulative += indexed[i].prob
    // Stop as soon as cumulative probability meets or exceeds p
    if (cumulative >= clampedP - 1e-9) {
      break
    }
  }

  // Ensure at least the top token is kept
  if (keptIndices.size === 0 && indexed.length > 0) {
    keptIndices.add(indexed[0].index)
  }

  const filtered = probs.map((prob, idx) => (keptIndices.has(idx) ? prob : 0))
  const sumFiltered = filtered.reduce((acc, val) => acc + val, 0)

  if (sumFiltered === 0) {
    const size = keptIndices.size
    return probs.map((_, idx) => (keptIndices.has(idx) ? 1 / size : 0))
  }

  return filtered.map((prob) => prob / sumFiltered)
}

/**
 * Samples a single token index from a probability distribution using a random number generator.
 * @param probs Array of probabilities summing to 1.
 * @param rng Function returning a pseudo-random number in [0, 1). Defaults to Math.random.
 */
export function sample(probs: number[], rng: () => number = Math.random): number {
  if (probs.length === 0) {
    return -1
  }

  const r = rng()
  let cumulative = 0

  for (let i = 0; i < probs.length; i++) {
    cumulative += probs[i]
    if (r <= cumulative && probs[i] > 0) {
      return i
    }
  }

  // Fallback to highest probability or last non-zero token
  for (let i = probs.length - 1; i >= 0; i--) {
    if (probs[i] > 0) return i
  }

  return probs.length - 1
}

/**
 * Samples N token indices from a probability distribution.
 */
export function sampleN(
  probs: number[],
  count: number,
  rng: () => number = Math.random
): number[] {
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    result.push(sample(probs, rng))
  }
  return result
}

/**
 * Creates a deterministic, fast pseudo-random number generator (Mulberry32).
 * Ideal for unit tests and reproducible sampling simulations.
 */
export function createSeededRng(seed: number = 42): () => number {
  let s = Math.floor(seed) >>> 0
  return function () {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SamplingTokenResult {
  token: string
  logit: number
  originalProb: number // base prob at T=1, before filtering
  tempProb: number // prob after temperature, before filtering
  finalProb: number // prob after temperature, top-k, and top-p filtering
  isCutOff: boolean // true if probability is zeroed out by top-k or top-p
}

export interface SamplingDistributionParams {
  temperature: number
  topK: number
  topP: number
}

/**
 * Computes the full sampling distribution across candidates:
 * 1. Computes baseline original probabilities (T=1, no filtering)
 * 2. Computes temperature-reshaped probabilities
 * 3. Applies top-k truncation and renormalization
 * 4. Applies top-p nucleus truncation and renormalization
 */
export function computeSamplingDistribution(
  candidates: CandidateToken[],
  options: SamplingDistributionParams
): SamplingTokenResult[] {
  const logits = candidates.map((c) => c.logit)
  const originalProbs = softmax(logits, 1.0)
  const tempProbs = softmax(logits, options.temperature)
  const topKProbs = applyTopK(tempProbs, options.topK)
  const finalProbs = applyTopP(topKProbs, options.topP)

  return candidates.map((candidate, idx) => ({
    token: candidate.token,
    logit: candidate.logit,
    originalProb: originalProbs[idx],
    tempProb: tempProbs[idx],
    finalProb: finalProbs[idx],
    isCutOff: finalProbs[idx] <= 1e-9 && originalProbs[idx] > 1e-9,
  }))
}
