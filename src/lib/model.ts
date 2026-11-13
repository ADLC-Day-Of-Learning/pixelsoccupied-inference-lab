/**
 * Pure, typed mathematical formulas for LLM inference serving estimates.
 * Single source of truth for math across Calculator and Play views.
 *
 * All formulas are pure functions: inputs in, numbers out (no React, no DOM).
 * Decimal units: 1 GB = 1e9 bytes, 1 KB = 1e3 bytes.
 */

export const BYTES_IN_GB = 1e9
export const BYTES_IN_KB = 1e3

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
}

export const GPU_PRESETS: GpuPreset[] = [
  { id: "a100-80gb", name: "A100 80GB", memoryGb: 80 },
  { id: "h100-80gb", name: "H100 80GB", memoryGb: 80 },
  { id: "l40s-48gb", name: "L40S 48GB", memoryGb: 48 },
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
    }
  }

  if (weightMemoryBytes > availableAfterOverhead) {
    const availableGb = availableAfterOverhead / BYTES_IN_GB
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
