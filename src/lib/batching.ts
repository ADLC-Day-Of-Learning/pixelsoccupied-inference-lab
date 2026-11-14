/**
 * Pure, typed simulation functions for static vs continuous batching in LLM inference.
 * Used by Play Level 4 (Batching).
 *
 * All formulas and algorithms are deterministic and pure: inputs in, numbers out (no React, no DOM).
 */

import {
  calculateWeightMemory,
  calculateKvCachePerToken,
  estimateDecodeStepTime,
  MODEL_PRESETS,
  GPU_PRESETS,
} from "./model"

export type BatchingMode = "static" | "continuous"

export interface BatchSimulationParams {
  mode: BatchingMode
  batchSize: number // 1 to 64
  arrivalRate?: number // requests per second (default: 25)
  seed?: number // PRNG seed for deterministic runs (default: 42)
  requestCount?: number // total requests simulated (default: 80)
  weightBytes?: number
  kvBytesPerToken?: number
  memoryBandwidthTb?: number
  latencySloSec?: number // default: 2.0s
}

export interface SimulatedRequest {
  id: number
  arrivalTime: number // in seconds
  promptTokens: number
  outputTokens: number
  startTime: number // when request first entered decoding
  finishTime: number // when final token was generated
  latencySec: number // finishTime - arrivalTime
}

export interface BatchSimulationResult {
  mode: BatchingMode
  batchSize: number
  arrivalRate: number
  tokensPerSecond: number
  p95LatencySec: number
  averageLatencySec: number
  gpuUtilization: number // 0 to 1
  totalTokensGenerated: number
  totalDurationSec: number
  completedRequestsCount: number
  requests: SimulatedRequest[]
  stepTimeMs: number
  formulaExplanation: {
    decodeStepTimeFormula: string
    throughputFormula: string
    utilizationFormula: string
  }
}

export interface BatchSweepPoint {
  batchSize: number
  tokensPerSecond: number
  p95LatencySec: number
  gpuUtilization: number
}

/**
 * 32-bit Mulberry32 seeded pseudo-random number generator.
 * Produces deterministic, uniform floating-point numbers in [0, 1).
 */
export function createPrng(seed: number): () => number {
  let s = (seed === 0 ? 1 : seed) >>> 0
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface RequestSpec {
  id: number
  arrivalTime: number
  promptTokens: number
  outputTokens: number
}

/**
 * Generates a deterministic stream of requests with varied arrival times,
 * prompt lengths, and output generation lengths.
 */
export function generateWorkload(
  requestCount: number,
  arrivalRate: number,
  seed = 42
): RequestSpec[] {
  const safeCount = Math.max(1, requestCount)
  const safeRate = Math.max(0.1, arrivalRate)
  const prng = createPrng(seed)
  const requests: RequestSpec[] = []
  let currentTime = 0

  for (let i = 0; i < safeCount; i++) {
    // Exponential inter-arrival time (Poisson arrival process)
    const u = Math.max(1e-6, prng())
    const interArrival = -Math.log(u) / safeRate
    currentTime += interArrival

    // Varied prompt tokens (128 to 384 tokens)
    const promptTokens = Math.floor(128 + prng() * 256)
    // Varied output generation tokens (30 to 180 tokens)
    const outputTokens = Math.floor(30 + prng() * 150)

    requests.push({
      id: i + 1,
      arrivalTime: Number(currentTime.toFixed(4)),
      promptTokens,
      outputTokens,
    })
  }

  return requests
}

interface RequestState {
  id: number
  arrivalTime: number
  promptTokens: number
  outputTokens: number
  remainingTokens: number
  tokensGenerated: number
  startTime: number
  finishTime: number
  latencySec: number
}

/**
 * Simulates batch decoding of a deterministic stream of requests under either
 * static or continuous batching strategies.
 *
 * - Static batching: waits until all requests in the batch finish before admitting new ones,
 *   leaving slots idle when shorter requests finish early.
 * - Continuous batching: checks on every step if slots are available and admits new requests
 *   immediately, eliminating idle bubbles.
 */
export function simulateBatching(
  params: BatchSimulationParams
): BatchSimulationResult {
  const mode = params.mode
  const batchSize = Math.max(1, Math.min(64, Math.round(params.batchSize || 1)))
  const arrivalRate = Math.max(0.1, params.arrivalRate ?? 25)
  const seed = params.seed ?? 42
  const requestCount = Math.max(1, params.requestCount ?? 80)

  // Default to Llama-3-8B on H100 (or A100 fallback)
  const defaultModel = MODEL_PRESETS[0]
  const defaultGpu =
    GPU_PRESETS.find((g) => g.id === "h100-80gb") ?? GPU_PRESETS[0]

  const weightBytes =
    params.weightBytes ?? calculateWeightMemory(defaultModel.parameters, "FP16")
  const kvBytesPerToken =
    params.kvBytesPerToken ??
    calculateKvCachePerToken(
      defaultModel.layers,
      defaultModel.kvHeads,
      defaultModel.headDim,
      "FP16"
    )
  const memoryBandwidthTb = params.memoryBandwidthTb ?? defaultGpu.memoryBandwidthTb

  const workload = generateWorkload(requestCount, arrivalRate, seed)
  const completed: SimulatedRequest[] = []

  let totalActiveSlotSteps = 0
  let totalCapacitySlotSteps = 0
  let totalStepTimeSec = 0
  let totalSteps = 0
  let simTime = workload[0]?.arrivalTime ?? 0

  if (mode === "static") {
    const queue: RequestState[] = []
    let nextWorkloadIndex = 0

    while (completed.length < workload.length) {
      // Ingest all requests that have arrived up to simTime
      while (
        nextWorkloadIndex < workload.length &&
        workload[nextWorkloadIndex].arrivalTime <= simTime
      ) {
        const r = workload[nextWorkloadIndex]
        queue.push({
          ...r,
          remainingTokens: r.outputTokens,
          tokensGenerated: 0,
          startTime: -1,
          finishTime: -1,
          latencySec: 0,
        })
        nextWorkloadIndex++
      }

      // If queue is empty, advance to next arrival
      if (queue.length === 0) {
        if (nextWorkloadIndex < workload.length) {
          simTime = workload[nextWorkloadIndex].arrivalTime
          continue
        }
        break
      }

      // Take up to batchSize requests into the static batch
      const currentBatch = queue.splice(0, batchSize)
      for (const req of currentBatch) {
        req.startTime = simTime
      }

      // Run until all requests in currentBatch have generated all their tokens
      while (currentBatch.some((r) => r.remainingTokens > 0)) {
        const activeInStep = currentBatch.filter((r) => r.remainingTokens > 0)
        const kvBytesRead = activeInStep.reduce(
          (sum, r) =>
            sum + (r.promptTokens + r.tokensGenerated) * kvBytesPerToken,
          0
        )

        const stepTime = estimateDecodeStepTime({
          weightBytes,
          kvBytesRead,
          memoryBandwidthTb,
        })
        totalStepTimeSec += stepTime
        totalSteps++

        simTime += stepTime
        totalActiveSlotSteps += activeInStep.length
        totalCapacitySlotSteps += batchSize

        for (const req of activeInStep) {
          req.tokensGenerated++
          req.remainingTokens--
          if (req.remainingTokens === 0) {
            req.finishTime = simTime
            req.latencySec = req.finishTime - req.arrivalTime
          }
        }
      }

      for (const req of currentBatch) {
        completed.push({
          id: req.id,
          arrivalTime: req.arrivalTime,
          promptTokens: req.promptTokens,
          outputTokens: req.outputTokens,
          startTime: req.startTime,
          finishTime: req.finishTime,
          latencySec: req.latencySec,
        })
      }
    }
  } else {
    // Continuous batching (iteration-level scheduling)
    const queue: RequestState[] = []
    let nextWorkloadIndex = 0
    const activeBatch: RequestState[] = []

    while (completed.length < workload.length) {
      // Ingest all requests that have arrived up to simTime
      while (
        nextWorkloadIndex < workload.length &&
        workload[nextWorkloadIndex].arrivalTime <= simTime
      ) {
        const r = workload[nextWorkloadIndex]
        queue.push({
          ...r,
          remainingTokens: r.outputTokens,
          tokensGenerated: 0,
          startTime: -1,
          finishTime: -1,
          latencySec: 0,
        })
        nextWorkloadIndex++
      }

      // Fill available batch slots immediately from queue
      while (activeBatch.length < batchSize && queue.length > 0) {
        const nextReq = queue.shift()!
        nextReq.startTime = simTime
        activeBatch.push(nextReq)
      }

      // If nothing is active and queue is empty, advance to next arrival
      if (activeBatch.length === 0) {
        if (nextWorkloadIndex < workload.length) {
          simTime = workload[nextWorkloadIndex].arrivalTime
          continue
        }
        break
      }

      // Compute step time based on active requests
      const kvBytesRead = activeBatch.reduce(
        (sum, r) =>
          sum + (r.promptTokens + r.tokensGenerated) * kvBytesPerToken,
        0
      )
      const stepTime = estimateDecodeStepTime({
        weightBytes,
        kvBytesRead,
        memoryBandwidthTb,
      })
      totalStepTimeSec += stepTime
      totalSteps++

      simTime += stepTime
      totalActiveSlotSteps += activeBatch.length
      totalCapacitySlotSteps += batchSize

      // Step each active request by 1 token
      for (let i = activeBatch.length - 1; i >= 0; i--) {
        const req = activeBatch[i]
        req.tokensGenerated++
        req.remainingTokens--

        if (req.remainingTokens === 0) {
          req.finishTime = simTime
          req.latencySec = req.finishTime - req.arrivalTime
          completed.push({
            id: req.id,
            arrivalTime: req.arrivalTime,
            promptTokens: req.promptTokens,
            outputTokens: req.outputTokens,
            startTime: req.startTime,
            finishTime: req.finishTime,
            latencySec: req.latencySec,
          })
          // Request leaves immediately; slot is free on the next step
          activeBatch.splice(i, 1)
        }
      }
    }
  }

  const completedRequestsCount = completed.length
  const totalTokensGenerated = completed.reduce(
    (sum, r) => sum + r.outputTokens,
    0
  )
  const firstArrival = workload[0]?.arrivalTime ?? 0
  const lastFinish =
    completed.length > 0
      ? Math.max(...completed.map((r) => r.finishTime))
      : simTime
  const totalDurationSec = Math.max(0.001, lastFinish - firstArrival)

  const tokensPerSecond = Math.round(totalTokensGenerated / totalDurationSec)

  const latencies = completed
    .map((r) => r.latencySec)
    .sort((a, b) => a - b)
  const averageLatencySec =
    latencies.length > 0
      ? Number(
          (
            latencies.reduce((sum, v) => sum + v, 0) / latencies.length
          ).toFixed(3)
        )
      : 0
  const p95Index = Math.min(
    latencies.length - 1,
    Math.floor(latencies.length * 0.95)
  )
  const p95LatencySec =
    latencies.length > 0 ? Number((latencies[p95Index] ?? 0).toFixed(3)) : 0

  const gpuUtilization =
    totalCapacitySlotSteps > 0
      ? Number((totalActiveSlotSteps / totalCapacitySlotSteps).toFixed(3))
      : 0

  const averageStepTimeSec = totalSteps > 0 ? totalStepTimeSec / totalSteps : 0
  const stepTimeMs = Number((averageStepTimeSec * 1000).toFixed(1))

  return {
    mode,
    batchSize,
    arrivalRate,
    tokensPerSecond,
    p95LatencySec,
    averageLatencySec,
    gpuUtilization,
    totalTokensGenerated,
    totalDurationSec: Number(totalDurationSec.toFixed(3)),
    completedRequestsCount,
    requests: completed,
    stepTimeMs,
    formulaExplanation: {
      decodeStepTimeFormula:
        "Decode step time ≈ (Weight bytes + KV bytes read) ÷ (Bandwidth × Utilization)",
      throughputFormula:
        "Throughput (tokens/s) = Total tokens generated ÷ Simulation duration",
      utilizationFormula:
        "GPU slot utilization = Active slot-steps ÷ (Max batch size × Total steps)",
    },
  }
}

/**
 * Sweeps a range of batch sizes (1 to 64) for charting throughput vs p95 latency.
 */
export function sweepBatchSizes(
  params: Omit<BatchSimulationParams, "batchSize">,
  batchSizes: number[] = [1, 2, 4, 8, 12, 16, 24, 32, 40, 48, 56, 64]
): BatchSweepPoint[] {
  return batchSizes.map((bs) => {
    const res = simulateBatching({ ...params, batchSize: bs })
    return {
      batchSize: bs,
      tokensPerSecond: res.tokensPerSecond,
      p95LatencySec: res.p95LatencySec,
      gpuUtilization: res.gpuUtilization,
    }
  })
}
