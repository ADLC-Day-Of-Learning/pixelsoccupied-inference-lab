/**
 * Pure, typed mathematical formulas for LLM inference serving estimates.
 * Single source of truth for math across Calculator and Play views.
 *
 * All formulas are pure functions: inputs in, numbers out (no React, no DOM).
 * Decimal units: 1 GB = 1e9 bytes, 1 KB = 1e3 bytes.
 */

export const BYTES_IN_GB = 1e9
export const BYTES_IN_KB = 1e3
export const BYTES_IN_TB = 1e12
export const FLOPS_IN_TFLOPS = 1e12

export const DEFAULT_COMPUTE_UTILIZATION = 0.5
export const DEFAULT_BANDWIDTH_UTILIZATION = 0.7

export type WeightPrecision = "FP16" | "FP8" | "INT4"
export type KvPrecision = "FP16" | "FP8"

export const BYTES_PER_PARAM: Record<WeightPrecision, number> = {
  FP16: 2,
  FP8: 1,
  INT4: 0.5,
}

export const BYTES_PER_KV_ELEMENT: Record<KvPrecision, number> = {
  FP16: 2,
  FP8: 1,
}

export interface ModelPreset {
  id: string
  name: string
  parameters: number // in raw count (e.g. 70e9)
  parametersBillions: number // for UI display (e.g. 70)
  layers: number
  kvHeads: number
  headDim: number
}

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: "llama-3-8b",
    name: "Llama-3-8B",
    parameters: 8e9,
    parametersBillions: 8,
    layers: 32,
    kvHeads: 8,
    headDim: 128,
  },
  {
    id: "llama-3-70b",
    name: "Llama-3-70B",
    parameters: 70e9,
    parametersBillions: 70,
    layers: 80,
    kvHeads: 8,
    headDim: 128,
  },
]

export interface GpuPreset {
  id: string
  name: string
  memoryGb: number
  peakTflops: number // peak dense FP16/BF16 Tensor Core TFLOPS
  memoryBandwidthTb: number // memory bandwidth in TB/s (1 TB = 1e12 bytes)
}

export const GPU_PRESETS: GpuPreset[] = [
  {
    id: "a100-80gb",
    name: "A100 80GB",
    memoryGb: 80,
    // NVIDIA A100 Tensor Core GPU Architecture / Datasheet:
    // Peak dense BF16/FP16 Tensor Core: 312 TFLOPS (dense) / 624 TFLOPS (structural sparsity)
    // Memory bandwidth: 2,039 GB/s (~2.0 TB/s) (HBM2e)
    peakTflops: 312,
    memoryBandwidthTb: 2.0,
  },
  {
    id: "h100-80gb",
    name: "H100 80GB SXM",
    memoryGb: 80,
    // NVIDIA H100 Tensor Core GPU Architecture / Datasheet:
    // Peak dense BF16/FP16 Tensor Core: 989 TFLOPS (dense) / 1,979 TFLOPS (structural sparsity)
    // Memory bandwidth: 3,350 GB/s (3.35 TB/s) (HBM3)
    peakTflops: 989,
    memoryBandwidthTb: 3.35,
  },
  {
    id: "l40s-48gb",
    name: "L40S 48GB",
    memoryGb: 48,
    // NVIDIA L40S GPU Datasheet:
    // Peak dense BF16/FP16 Tensor Core: 366 TFLOPS (dense) / 733 TFLOPS (structural sparsity)
    // Memory bandwidth: 864 GB/s (0.864 TB/s) (GDDR6)
    peakTflops: 366,
    memoryBandwidthTb: 0.864,
  },
]

/**
 * Weight memory in bytes = parameters × bytes per parameter
 * (FP16 = 2, FP8 = 1, INT4 = 0.5)
 */
export function calculateWeightMemory(
  parameters: number,
  precision: WeightPrecision
): number {
  const bytesPerParam = BYTES_PER_PARAM[precision] ?? 2
  return parameters * bytesPerParam
}

/**
 * KV cache per token in bytes = 2 × layers × KV heads × head dim × bytes per element
 * (Factor of 2 accounts for both Key and Value vectors)
 */
export function calculateKvCachePerToken(
  layers: number,
  kvHeads: number,
  headDim: number,
  precision: KvPrecision
): number {
  const bytesPerElement = BYTES_PER_KV_ELEMENT[precision] ?? 2
  return 2 * layers * kvHeads * headDim * bytesPerElement
}

/**
 * Free memory available for KV cache in bytes = total GPU memory − weight memory − overhead
 */
export function calculateFreeMemoryForKv(
  totalGpuMemoryBytes: number,
  weightMemoryBytes: number,
  overheadBytes: number
): number {
  return Math.max(0, totalGpuMemoryBytes - weightMemoryBytes - overheadBytes)
}

export interface KvCapacityParams {
  totalGpuMemoryBytes: number
  weightMemoryBytes: number
  overheadBytes: number
  kvPerTokenBytes: number
}

export interface KvCapacityResult {
  tokens: number
  freeMemoryBytes: number
}

/**
 * KV capacity in tokens = free memory ÷ KV per token bytes
 * Overloaded to support both (freeMemoryBytes, kvPerTokenBytes) and param object.
 */
export function calculateKvCapacity(
  freeMemoryBytes: number,
  kvPerTokenBytes: number
): number
export function calculateKvCapacity(params: KvCapacityParams): KvCapacityResult
export function calculateKvCapacity(
  arg1: number | KvCapacityParams,
  arg2?: number
): number | KvCapacityResult {
  if (typeof arg1 === "object") {
    const freeMemoryBytes = calculateFreeMemoryForKv(
      arg1.totalGpuMemoryBytes,
      arg1.weightMemoryBytes,
      arg1.overheadBytes
    )
    const tokens =
      arg1.kvPerTokenBytes > 0
        ? Math.floor(freeMemoryBytes / arg1.kvPerTokenBytes)
        : 0
    return {
      tokens: Math.max(0, tokens),
      freeMemoryBytes,
    }
  }

  const freeMemoryBytes = arg1
  const kvPerTokenBytes = arg2 ?? 0
  if (kvPerTokenBytes <= 0) return 0
  return Math.max(0, Math.floor(freeMemoryBytes / kvPerTokenBytes))
}

/**
 * Max concurrent requests at the given context length = floor(KV capacity ÷ context length)
 */
export function calculateMaxConcurrency(
  kvCapacityTokens: number,
  contextLengthTokens: number
): number {
  if (contextLengthTokens <= 0) return 0
  return Math.max(0, Math.floor(kvCapacityTokens / contextLengthTokens))
}

export interface MemoryFitParams {
  parameters: number
  precision: WeightPrecision
  gpuMemoryBytes?: number
  totalGpuMemoryBytes?: number
  gpuCount?: number
  overheadBytes?: number
  overheadFraction?: number
}

export interface MemoryFitResult {
  fits: boolean
  verdict: string
  weightMemoryBytes: number
  weightMemoryGb: number
  totalGpuMemoryBytes: number
  totalGpuMemoryGb: number
  overheadBytes: number
  overheadGb: number
  freeMemoryBytes: number
  freeMemoryGb: number
  shortfallBytes: number
  shortfallGb: number
}

/**
 * Calculate memory shortfall in bytes when a model does not fit in GPU memory.
 * Returns 0 if the model fits.
 */
export function calculateMemoryShortfall(
  weightMemoryBytes: number,
  totalGpuMemoryBytes: number,
  overheadBytes: number = 0
): number {
  const availableAfterOverhead = Math.max(0, totalGpuMemoryBytes - overheadBytes)
  if (weightMemoryBytes > totalGpuMemoryBytes) {
    return Math.max(0, weightMemoryBytes - totalGpuMemoryBytes)
  }
  if (weightMemoryBytes > availableAfterOverhead) {
    return Math.max(0, weightMemoryBytes - availableAfterOverhead)
  }
  return 0
}

/**
 * Evaluates whether a model fits in GPU memory and provides a clear verdict.
 */
export function evaluateMemoryFit(params: MemoryFitParams): MemoryFitResult {
  const gpuCount = params.gpuCount ?? 1
  const singleGpuBytes = params.gpuMemoryBytes ?? 0
  const totalGpuMemoryBytes =
    params.totalGpuMemoryBytes ?? singleGpuBytes * gpuCount

  const weightMemoryBytes = calculateWeightMemory(
    params.parameters,
    params.precision
  )

  const overheadBytes =
    params.overheadBytes ??
    (params.overheadFraction !== undefined
      ? totalGpuMemoryBytes * params.overheadFraction
      : totalGpuMemoryBytes * 0.1)

  const weightMemoryGb = weightMemoryBytes / BYTES_IN_GB
  const totalGpuMemoryGb = totalGpuMemoryBytes / BYTES_IN_GB
  const overheadGb = overheadBytes / BYTES_IN_GB

  const availableAfterOverhead = totalGpuMemoryBytes - overheadBytes
  const freeMemoryBytes = calculateFreeMemoryForKv(
    totalGpuMemoryBytes,
    weightMemoryBytes,
    overheadBytes
  )
  const freeMemoryGb = freeMemoryBytes / BYTES_IN_GB

  const formatGb = (gb: number): string => {
    const rounded = Number(gb.toFixed(1))
    return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)
  }

  if (weightMemoryBytes > totalGpuMemoryBytes) {
    const shortfallBytes = calculateMemoryShortfall(
      weightMemoryBytes,
      totalGpuMemoryBytes,
      overheadBytes
    )
    return {
      fits: false,
      verdict: `Does not fit: weights need ${formatGb(weightMemoryGb)} GB, but only ${formatGb(totalGpuMemoryGb)} GB is available`,
      weightMemoryBytes,
      weightMemoryGb,
      totalGpuMemoryBytes,
      totalGpuMemoryGb,
      overheadBytes,
      overheadGb,
      freeMemoryBytes: 0,
      freeMemoryGb: 0,
      shortfallBytes,
      shortfallGb: shortfallBytes / BYTES_IN_GB,
    }
  }

  if (weightMemoryBytes > availableAfterOverhead) {
    const availableGb = availableAfterOverhead / BYTES_IN_GB
    const shortfallBytes = calculateMemoryShortfall(
      weightMemoryBytes,
      totalGpuMemoryBytes,
      overheadBytes
    )
    return {
      fits: false,
      verdict: `Does not fit: weights need ${formatGb(weightMemoryGb)} GB, but only ${formatGb(availableGb)} GB is available after overhead`,
      weightMemoryBytes,
      weightMemoryGb,
      totalGpuMemoryBytes,
      totalGpuMemoryGb,
      overheadBytes,
      overheadGb,
      freeMemoryBytes: 0,
      freeMemoryGb: 0,
      shortfallBytes,
      shortfallGb: shortfallBytes / BYTES_IN_GB,
    }
  }

  return {
    fits: true,
    verdict: "Fits",
    weightMemoryBytes,
    weightMemoryGb,
    totalGpuMemoryBytes,
    totalGpuMemoryGb,
    overheadBytes,
    overheadGb,
    freeMemoryBytes,
    freeMemoryGb,
    shortfallBytes: 0,
    shortfallGb: 0,
  }
}

/**
 * Format bytes to decimal GB string.
 */
export function bytesToGb(bytes: number, decimals: number = 1): string {
  return (bytes / BYTES_IN_GB).toFixed(decimals)
}

/**
 * Format bytes to decimal KB string.
 */
export function bytesToKb(bytes: number, decimals: number = 2): string {
  return (bytes / BYTES_IN_KB).toFixed(decimals)
}

export interface PrefillTimeParams {
  parameters: number
  promptTokens: number
  peakFlops?: number
  peakTflops?: number
  gpuCount?: number
  computeUtilization?: number
}

/**
 * Estimates prefill (Time to First Token / TTFT) duration in seconds.
 *
 * Formula:
 *   Prefill time ≈ (2 × parameters × prompt_tokens) ÷ (peak_FLOPS × GPUs × utilization)
 *
 * Simplifying assumptions:
 * - Assumes 2 FLOPs per parameter per token (standard linear projection & feed-forward estimate: 1 multiply + 1 add).
 * - Ignores quadratic attention matrix multiplication FLOPs (typically < 1-2% for context lengths <= 4k-8k).
 * - Ignores inter-GPU communication / tensor parallelism overhead.
 * - Ignores kernel launch overhead and memory-bound operations during prefill.
 * - Model FLOPs Utilization (MFU) is lumped into computeUtilization (default: 0.5 = 50%).
 *
 * @param params Prefill estimation parameters or positional overload
 * @returns Estimated prefill time in seconds (0 on non-positive inputs or zero capacity)
 */
export function estimatePrefillTime(params: PrefillTimeParams): number
export function estimatePrefillTime(
  parameters: number,
  promptTokens: number,
  peakFlops: number,
  gpuCount?: number,
  computeUtilization?: number
): number
export function estimatePrefillTime(
  arg1: number | PrefillTimeParams,
  arg2?: number,
  arg3?: number,
  arg4?: number,
  arg5?: number
): number {
  if (typeof arg1 === "object") {
    const parameters = Math.max(0, arg1.parameters)
    const promptTokens = Math.max(0, arg1.promptTokens)
    const gpuCount = arg1.gpuCount ?? 1
    const utilization =
      arg1.computeUtilization !== undefined
        ? arg1.computeUtilization
        : DEFAULT_COMPUTE_UTILIZATION

    const peakFlops =
      arg1.peakFlops ??
      (arg1.peakTflops !== undefined ? arg1.peakTflops * FLOPS_IN_TFLOPS : 0)

    const totalFlops = 2 * parameters * promptTokens
    const effectiveFlops = peakFlops * gpuCount * utilization

    if (effectiveFlops <= 0 || totalFlops <= 0) return 0
    return totalFlops / effectiveFlops
  }

  const parameters = Math.max(0, arg1)
  const promptTokens = Math.max(0, arg2 ?? 0)
  const peakFlops = Math.max(0, arg3 ?? 0)
  const gpuCount = arg4 ?? 1
  const utilization =
    arg5 !== undefined ? arg5 : DEFAULT_COMPUTE_UTILIZATION

  const totalFlops = 2 * parameters * promptTokens
  const effectiveFlops = peakFlops * gpuCount * utilization

  if (effectiveFlops <= 0 || totalFlops <= 0) return 0
  return totalFlops / effectiveFlops
}

export interface DecodeStepTimeParams {
  weightBytes: number
  kvBytesRead: number
  memoryBandwidthBytesPerSec?: number
  bandwidthBytesPerSec?: number
  memoryBandwidthTb?: number
  gpuCount?: number
  bandwidthUtilization?: number
}

/**
 * Estimates decode step latency in seconds for a single auto-regressive token generation step.
 *
 * Formula:
 *   Decode step time ≈ (weight_bytes + KV_bytes_read_for_batch) ÷ (memory_bandwidth × GPUs × utilization)
 *
 * Simplifying assumptions:
 * - Assumes decode phase is purely memory-bandwidth bound (reading model weights once per step +
 *   reading the accumulated KV cache for each request in the active batch).
 * - Assumes weights are streamed once from HBM/VRAM per step regardless of batch size
 *   (valid for small-to-medium batch sizes before decode transitions to compute-bound).
 * - Ignores tensor-parallel all-reduce communication latency between GPUs.
 * - Ignores kernel launch overhead and non-memory-bound activation compute.
 * - Memory bandwidth utilization is lumped into bandwidthUtilization (default: 0.7 = 70%).
 *
 * @param params Decode step estimation parameters or positional overload
 * @returns Estimated decode step time in seconds (0 on non-positive inputs or zero capacity)
 */
export function estimateDecodeStepTime(params: DecodeStepTimeParams): number
export function estimateDecodeStepTime(
  weightBytes: number,
  kvBytesRead: number,
  memoryBandwidthBytesPerSec: number,
  gpuCount?: number,
  bandwidthUtilization?: number
): number
export function estimateDecodeStepTime(
  arg1: number | DecodeStepTimeParams,
  arg2?: number,
  arg3?: number,
  arg4?: number,
  arg5?: number
): number {
  if (typeof arg1 === "object") {
    const weightBytes = Math.max(0, arg1.weightBytes)
    const kvBytesRead = Math.max(0, arg1.kvBytesRead)
    const gpuCount = arg1.gpuCount ?? 1
    const utilization =
      arg1.bandwidthUtilization !== undefined
        ? arg1.bandwidthUtilization
        : DEFAULT_BANDWIDTH_UTILIZATION

    const bandwidthBytesPerSec =
      arg1.memoryBandwidthBytesPerSec ??
      arg1.bandwidthBytesPerSec ??
      (arg1.memoryBandwidthTb !== undefined
        ? arg1.memoryBandwidthTb * BYTES_IN_TB
        : 0)

    const totalBytes = weightBytes + kvBytesRead
    const effectiveBandwidth = bandwidthBytesPerSec * gpuCount * utilization

    if (effectiveBandwidth <= 0 || totalBytes <= 0) return 0
    return totalBytes / effectiveBandwidth
  }

  const weightBytes = Math.max(0, arg1)
  const kvBytesRead = Math.max(0, arg2 ?? 0)
  const bandwidthBytesPerSec = Math.max(0, arg3 ?? 0)
  const gpuCount = arg4 ?? 1
  const utilization =
    arg5 !== undefined ? arg5 : DEFAULT_BANDWIDTH_UTILIZATION

  const totalBytes = weightBytes + kvBytesRead
  const effectiveBandwidth = bandwidthBytesPerSec * gpuCount * utilization

  if (effectiveBandwidth <= 0 || totalBytes <= 0) return 0
  return totalBytes / effectiveBandwidth
}

export interface DecodeTokensPerSecondParams {
  stepTimeSeconds: number
  batchSize?: number
}

export interface DecodeTokensPerSecondResult {
  perRequestTokensPerSecond: number
  aggregateTokensPerSecond: number
}

/**
 * Calculates decode throughput in tokens per second, both per individual request
 * and in aggregate across the batch.
 *
 * Formulas:
 *   per-request tokens/s = 1 ÷ step_time_seconds
 *   aggregate tokens/s = batch_size ÷ step_time_seconds
 *
 * Properties:
 * - As batch size increases, step time increases slightly (due to reading more KV cache bytes),
 *   causing per-request tokens/s to decrease slightly.
 * - However, aggregate throughput (batchSize / stepTime) increases significantly because weight
 *   memory bandwidth cost is amortized across all concurrent requests in the batch.
 *
 * @param params Decode throughput parameters or positional stepTimeSeconds
 * @param batchSize Optional batch size (defaults to 1) for positional overload
 * @returns DecodeTokensPerSecondResult with perRequestTokensPerSecond and aggregateTokensPerSecond
 */
export function estimateDecodeTokensPerSecond(
  params: DecodeTokensPerSecondParams
): DecodeTokensPerSecondResult
export function estimateDecodeTokensPerSecond(
  stepTimeSeconds: number,
  batchSize?: number
): DecodeTokensPerSecondResult
export function estimateDecodeTokensPerSecond(
  arg1: number | DecodeTokensPerSecondParams,
  arg2?: number
): DecodeTokensPerSecondResult {
  const stepTimeSeconds = typeof arg1 === "object" ? arg1.stepTimeSeconds : arg1
  const rawBatchSize =
    typeof arg1 === "object" ? (arg1.batchSize ?? 1) : (arg2 ?? 1)

  if (stepTimeSeconds <= 0 || rawBatchSize <= 0) {
    return {
      perRequestTokensPerSecond: 0,
      aggregateTokensPerSecond: 0,
    }
  }

  const perRequestTokensPerSecond = 1 / stepTimeSeconds
  const aggregateTokensPerSecond = rawBatchSize / stepTimeSeconds

  return {
    perRequestTokensPerSecond,
    aggregateTokensPerSecond,
  }
}
