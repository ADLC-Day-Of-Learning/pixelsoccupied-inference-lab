import { describe, it, expect } from "vitest"
import {
  createPrng,
  generateWorkload,
  simulateBatching,
  sweepBatchSizes,
} from "./batching"

describe("createPrng", () => {
  it("produces deterministic numbers from the same seed", () => {
    const prng1 = createPrng(42)
    const prng2 = createPrng(42)

    const seq1 = [prng1(), prng1(), prng1()]
    const seq2 = [prng2(), prng2(), prng2()]

    expect(seq1).toEqual(seq2)
  })

  it("produces different numbers from different seeds", () => {
    const prng1 = createPrng(42)
    const prng2 = createPrng(99)

    expect(prng1()).not.toEqual(prng2())
  })
})

describe("generateWorkload", () => {
  it("generates deterministic request specs with requested count", () => {
    const w1 = generateWorkload(20, 25, 123)
    const w2 = generateWorkload(20, 25, 123)

    expect(w1).toHaveLength(20)
    expect(w1).toEqual(w2)
    expect(w1[0].arrivalTime).toBeGreaterThan(0)
    expect(w1[0].outputTokens).toBeGreaterThanOrEqual(30)
    expect(w1[0].outputTokens).toBeLessThanOrEqual(180)
  })
})

describe("simulateBatching", () => {
  it("demonstrates continuous batching produces higher throughput than static batching at equal batch size", () => {
    const seed = 42
    const batchSize = 16
    const arrivalRate = 25

    const staticRun = simulateBatching({
      mode: "static",
      batchSize,
      arrivalRate,
      seed,
    })

    const continuousRun = simulateBatching({
      mode: "continuous",
      batchSize,
      arrivalRate,
      seed,
    })

    expect(continuousRun.tokensPerSecond).toBeGreaterThan(staticRun.tokensPerSecond)
    expect(continuousRun.p95LatencySec).toBeGreaterThan(0)
    expect(staticRun.p95LatencySec).toBeGreaterThan(0)
    expect(continuousRun.gpuUtilization).toBeGreaterThan(staticRun.gpuUtilization)
  })

  it("demonstrates continuous batching produces lower p95 latency than static batching", () => {
    const seed = 42
    const batchSize = 16
    const arrivalRate = 25

    const staticRun = simulateBatching({
      mode: "static",
      batchSize,
      arrivalRate,
      seed,
    })

    const continuousRun = simulateBatching({
      mode: "continuous",
      batchSize,
      arrivalRate,
      seed,
    })

    // Because static batching holds requests in queue waiting for the slowest request in the batch,
    // continuous batching achieves lower p95 latency.
    expect(continuousRun.p95LatencySec).toBeLessThan(staticRun.p95LatencySec)
  })

  it("handles batch size 1 where static and continuous batching have identical slot behavior", () => {
    const staticRun = simulateBatching({
      mode: "static",
      batchSize: 1,
      seed: 42,
    })

    const continuousRun = simulateBatching({
      mode: "continuous",
      batchSize: 1,
      seed: 42,
    })

    // When batch size is 1, both modes process one request at a time
    expect(staticRun.completedRequestsCount).toBeGreaterThan(0)
    expect(continuousRun.completedRequestsCount).toBeGreaterThan(0)
    expect(continuousRun.tokensPerSecond).toBeCloseTo(staticRun.tokensPerSecond, -2)
  })

  it("increases aggregate throughput as batch size increases", () => {
    const runBatch4 = simulateBatching({
      mode: "continuous",
      batchSize: 4,
      seed: 42,
    })

    const runBatch32 = simulateBatching({
      mode: "continuous",
      batchSize: 32,
      seed: 42,
    })

    expect(runBatch32.tokensPerSecond).toBeGreaterThan(runBatch4.tokensPerSecond)
  })

  it("handles boundary inputs gracefully (non-positive or extreme inputs)", () => {
    const zeroRun = simulateBatching({
      mode: "continuous",
      batchSize: 0,
      arrivalRate: 0,
      requestCount: 0,
    })

    expect(zeroRun.batchSize).toBe(1)
    expect(zeroRun.arrivalRate).toBeGreaterThan(0)
    expect(zeroRun.tokensPerSecond).toBeGreaterThan(0)
    expect(zeroRun.completedRequestsCount).toBeGreaterThan(0)
  })

  it("reaches >= 2000 tokens/s under continuous batching at larger batch size", () => {
    const run = simulateBatching({
      mode: "continuous",
      batchSize: 32,
      arrivalRate: 30,
      seed: 42,
    })

    expect(run.tokensPerSecond).toBeGreaterThanOrEqual(2000)
    expect(run.p95LatencySec).toBeLessThanOrEqual(2.0)
  })
})

describe("sweepBatchSizes", () => {
  it("returns points across sampled batch sizes", () => {
    const sweep = sweepBatchSizes({
      mode: "continuous",
      arrivalRate: 25,
      seed: 42,
    })

    expect(sweep.length).toBeGreaterThan(5)
    expect(sweep[0].batchSize).toBe(1)
    expect(sweep[sweep.length - 1].batchSize).toBe(64)

    // Throughput generally increases with batch size
    expect(sweep[sweep.length - 1].tokensPerSecond).toBeGreaterThan(
      sweep[0].tokensPerSecond
    )
  })
})
