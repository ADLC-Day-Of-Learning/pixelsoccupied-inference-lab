import { describe, it, expect } from "vitest"
import {
  softmax,
  applyTopK,
  applyTopP,
  sample,
  sampleN,
  createSeededRng,
  computeSamplingDistribution,
  DEFAULT_CANDIDATE_TOKENS,
  type SamplingDistributionParams,
} from "./sampling"

describe("sampling math (src/lib/sampling.ts)", () => {
  describe("softmax", () => {
    it("returns empty array for empty logits", () => {
      expect(softmax([])).toEqual([])
    })

    it("calculates probabilities that sum to 1.0 across temperatures", () => {
      const logits = [2.5, 1.5, 1.0, 0.3, -0.2, -0.8, -1.5, -2.2]
      const temperatures = [0.1, 0.5, 1.0, 1.5, 2.0]

      for (const temp of temperatures) {
        const probs = softmax(logits, temp)
        expect(probs).toHaveLength(logits.length)
        const sum = probs.reduce((acc, p) => acc + p, 0)
        expect(sum).toBeCloseTo(1.0, 6)
        probs.forEach((p) => {
          expect(p).toBeGreaterThanOrEqual(0)
          expect(p).toBeLessThanOrEqual(1.0)
        })
      }
    })

    it("approaches greedy argmax decoding as temperature approaches 0", () => {
      const logits = [2.4, 1.6, 1.1, 0.5, -0.2]
      const greedy = softmax(logits, 0.0)
      expect(greedy[0]).toBe(1.0)
      for (let i = 1; i < greedy.length; i++) {
        expect(greedy[i]).toBe(0.0)
      }

      const nearZero = softmax(logits, 0.001)
      expect(nearZero[0]).toBeGreaterThan(0.999)
      expect(nearZero[1]).toBeLessThan(0.001)
    })

    it("flattens the distribution as temperature increases", () => {
      const logits = [2.4, 1.6, 1.1, 0.5]
      const standard = softmax(logits, 1.0)
      const hot = softmax(logits, 2.0)

      // The highest probability is lower under high temperature
      expect(hot[0]).toBeLessThan(standard[0])
      // The lowest probability is higher under high temperature
      expect(hot[3]).toBeGreaterThan(standard[3])
    })

    it("handles large logits without numerical overflow", () => {
      const largeLogits = [1000, 1002, 999]
      const probs = softmax(largeLogits, 1.0)
      expect(probs[1]).toBeGreaterThan(probs[0])
      expect(probs[0]).toBeGreaterThan(probs[2])
      const sum = probs.reduce((acc, p) => acc + p, 0)
      expect(sum).toBeCloseTo(1.0, 6)
    })

    it("splits evenly among tied maximum logits at temperature = 0", () => {
      const tied = [3.0, 1.0, 3.0]
      const probs = softmax(tied, 0)
      expect(probs).toEqual([0.5, 0, 0.5])
    })
  })

  describe("applyTopK", () => {
    it("returns empty array for empty probs", () => {
      expect(applyTopK([], 3)).toEqual([])
    })

    it("restricts to top-1 token when k = 1", () => {
      const probs = [0.5, 0.3, 0.15, 0.05]
      const filtered = applyTopK(probs, 1)
      expect(filtered).toEqual([1.0, 0, 0, 0])
    })

    it("truncates tail tokens and renormalizes remaining probabilities", () => {
      const probs = [0.5, 0.25, 0.15, 0.1]
      const filtered = applyTopK(probs, 2)
      // Top 2 are indices 0 (0.5) and 1 (0.25), sum = 0.75
      expect(filtered[0]).toBeCloseTo(0.5 / 0.75, 6)
      expect(filtered[1]).toBeCloseTo(0.25 / 0.75, 6)
      expect(filtered[2]).toBe(0)
      expect(filtered[3]).toBe(0)

      const sum = filtered.reduce((acc, p) => acc + p, 0)
      expect(sum).toBeCloseTo(1.0, 6)
    })

    it("keeps all tokens when k is greater than or equal to length", () => {
      const probs = [0.4, 0.3, 0.2, 0.1]
      const filtered = applyTopK(probs, 4)
      probs.forEach((p, idx) => {
        expect(filtered[idx]).toBeCloseTo(p, 6)
      })
      const filteredLarger = applyTopK(probs, 10)
      probs.forEach((p, idx) => {
        expect(filteredLarger[idx]).toBeCloseTo(p, 6)
      })
    })
  })

  describe("applyTopP (nucleus sampling)", () => {
    it("returns empty array for empty probs", () => {
      expect(applyTopP([], 0.9)).toEqual([])
    })

    it("keeps all tokens when p = 1.0", () => {
      const probs = [0.4, 0.3, 0.2, 0.1]
      const filtered = applyTopP(probs, 1.0)
      probs.forEach((p, idx) => {
        expect(filtered[idx]).toBeCloseTo(p, 6)
      })
    })

    it("keeps smallest set covering cumulative mass p and renormalizes", () => {
      // Tokens sorted descending: 0 (0.5), 1 (0.3), 2 (0.15), 3 (0.05)
      const probs = [0.5, 0.3, 0.15, 0.05]

      // For p = 0.5: first token has 0.5 >= 0.5 -> only token 0 kept
      const filteredAt05 = applyTopP(probs, 0.5)
      expect(filteredAt05).toEqual([1.0, 0, 0, 0])

      // For p = 0.7: token 0 (0.5) + token 1 (0.3) = 0.8 >= 0.7 -> tokens 0 and 1 kept
      const filteredAt07 = applyTopP(probs, 0.7)
      expect(filteredAt07[0]).toBeCloseTo(0.5 / 0.8, 6)
      expect(filteredAt07[1]).toBeCloseTo(0.3 / 0.8, 6)
      expect(filteredAt07[2]).toBe(0)
      expect(filteredAt07[3]).toBe(0)
      expect(filteredAt07.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 6)
    })

    it("always keeps at least the top token even for tiny p", () => {
      const probs = [0.4, 0.3, 0.2, 0.1]
      const filtered = applyTopP(probs, 0.01)
      expect(filtered[0]).toBe(1.0)
      expect(filtered[1]).toBe(0)
      expect(filtered[2]).toBe(0)
      expect(filtered[3]).toBe(0)
    })
  })

  describe("sample and sampleN with seeded RNG", () => {
    it("samples a single token index using sample", () => {
      const probs = [0, 1.0, 0]
      const idx = sample(probs)
      expect(idx).toBe(1)
    })

    it("samples deterministically using a seeded RNG", () => {
      const probs = [0.5, 0.3, 0.2]
      const rng1 = createSeededRng(12345)
      const rng2 = createSeededRng(12345)

      const samples1 = sampleN(probs, 20, rng1)
      const samples2 = sampleN(probs, 20, rng2)

      expect(samples1).toHaveLength(20)
      expect(samples1).toEqual(samples2)
    })

    it("never samples tokens that have 0 probability", () => {
      // Token index 1 has 0 probability
      const probs = [0.7, 0.0, 0.3]
      const rng = createSeededRng(42)
      const samples = sampleN(probs, 100, rng)

      expect(samples.every((idx) => idx === 0 || idx === 2)).toBe(true)
      expect(samples).not.toContain(1)
    })

    it("always samples the single 1.0 probability token", () => {
      const probs = [0, 1.0, 0]
      const rng = createSeededRng(99)
      const samples = sampleN(probs, 20, rng)
      expect(samples.every((idx) => idx === 1)).toBe(true)
    })
  })

  describe("DEFAULT_CANDIDATE_TOKENS and computeSamplingDistribution", () => {
    it("has exactly 4 candidate tokens with original probability >= 5% at T=1.0", () => {
      const distribution = computeSamplingDistribution(DEFAULT_CANDIDATE_TOKENS, {
        temperature: 1.0,
        topK: 8,
        topP: 1.0,
      })

      const tokensAbove5 = distribution.filter((d) => d.originalProb >= 0.05)
      const tokensBelow5 = distribution.filter((d) => d.originalProb < 0.05)

      expect(tokensAbove5.map((t) => t.token)).toEqual([
        "Paris",
        "Lyon",
        "Marseille",
        "the",
      ])
      expect(tokensBelow5.map((t) => t.token)).toEqual([
        "a",
        "located",
        "beautiful",
        "known",
      ])

      // Paris is the most probable token
      expect(tokensAbove5[0].token).toBe("Paris")
      expect(tokensAbove5[0].originalProb).toBeGreaterThan(0.45)
    })

    it("greys out cut off tokens when topK is applied", () => {
      const distribution = computeSamplingDistribution(DEFAULT_CANDIDATE_TOKENS, {
        temperature: 1.0,
        topK: 4,
        topP: 1.0,
      })

      // Top 4 tokens should be active
      for (let i = 0; i < 4; i++) {
        expect(distribution[i].isCutOff).toBe(false)
        expect(distribution[i].finalProb).toBeGreaterThan(0)
      }

      // Tail 4 tokens should be cut off
      for (let i = 4; i < 8; i++) {
        expect(distribution[i].isCutOff).toBe(true)
        expect(distribution[i].finalProb).toBe(0)
      }
    })

    it("supports Challenge 1: greedy or topK=1 assigns 100% to Paris and cuts off non-argmax tokens", () => {
      const greedyParams: SamplingDistributionParams = {
        temperature: 0.0,
        topK: 8,
        topP: 1.0,
      }
      const greedyDist = computeSamplingDistribution(
        DEFAULT_CANDIDATE_TOKENS,
        greedyParams
      )
      expect(greedyDist[0].token).toBe("Paris")
      expect(greedyDist[0].finalProb).toBe(1.0)
      expect(greedyDist[0].isCutOff).toBe(false)

      // In greedy decoding, all non-argmax tokens should be marked as cut off
      for (let i = 1; i < greedyDist.length; i++) {
        expect(greedyDist[i].finalProb).toBe(0)
        expect(greedyDist[i].isCutOff).toBe(true)
      }

      const top1Dist = computeSamplingDistribution(DEFAULT_CANDIDATE_TOKENS, {
        temperature: 1.0,
        topK: 1,
        topP: 1.0,
      })
      expect(top1Dist[0].token).toBe("Paris")
      expect(top1Dist[0].finalProb).toBe(1.0)
      expect(top1Dist[0].isCutOff).toBe(false)
      for (let i = 1; i < top1Dist.length; i++) {
        expect(top1Dist[i].finalProb).toBe(0)
        expect(top1Dist[i].isCutOff).toBe(true)
      }
    })
  })
})
