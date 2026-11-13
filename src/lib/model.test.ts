import { describe, it, expect } from "vitest"
import {
  calculateWeightMemory,
  calculateKvCachePerToken,
  calculateFreeMemoryForKv,
  calculateKvCapacity,
  calculateMaxConcurrency,
  evaluateMemoryFit,
  calculateMemoryBreakdown,
  bytesToGb,
  bytesToKb,
  estimatePrefillTime,
  estimateDecodeStepTime,
  estimateDecodeTokensPerSecond,
  GPU_PRESETS,
  BYTES_IN_GB,
  DEFAULT_COMPUTE_UTILIZATION,
  DEFAULT_BANDWIDTH_UTILIZATION,
} from "./model"

describe("model formulas", () => {
  describe("weight memory", () => {
    it("computes weight memory for 70B params at FP16 -> 140 GB", () => {
      // 70B parameters * 2 bytes = 140 GB (140e9 bytes)
      expect(calculateWeightMemory(70e9, "FP16")).toBe(140e9)
    })

    it("computes weight memory for 8B params at FP16 -> 16 GB", () => {
      expect(calculateWeightMemory(8e9, "FP16")).toBe(16e9)
    })

    it("computes weight memory for 70B params at FP8 -> 70 GB", () => {
      expect(calculateWeightMemory(70e9, "FP8")).toBe(70e9)
    })

    it("computes weight memory for 70B params at INT4 -> 35 GB", () => {
      expect(calculateWeightMemory(70e9, "INT4")).toBe(35e9)
    })
  })

  describe("KV cache per token", () => {
    it("computes KV cache per token for Llama-3-8B (32 layers, 8 KV heads, head dim 128) at FP16 -> 131,072 bytes", () => {
      // 2 * 32 layers * 8 KV heads * 128 head dim * 2 bytes = 131,072 bytes (128 KiB)
      expect(calculateKvCachePerToken(32, 8, 128, "FP16")).toBe(131072)
    })

    it("computes KV cache per token for Llama-3-8B at FP8 -> 65,536 bytes", () => {
      // 2 * 32 * 8 * 128 * 1 byte = 65,536 bytes
      expect(calculateKvCachePerToken(32, 8, 128, "FP8")).toBe(65536)
    })

    it("computes KV cache per token for Llama-3-70B (80 layers, 8 KV heads, head dim 128) at FP16 -> 327,680 bytes", () => {
      // 2 * 80 * 8 * 128 * 2 bytes = 327,680 bytes
      expect(calculateKvCachePerToken(80, 8, 128, "FP16")).toBe(327680)
    })
  })

  describe("free memory and KV capacity", () => {
    it("computes free memory for KV cache correctly", () => {
      // 2x 80GB GPUs (160 GB) - 140 GB weights - 16 GB overhead = 4 GB free
      const free = calculateFreeMemoryForKv(160e9, 140e9, 16e9)
      expect(free).toBe(4e9)
    })

    it("clamps negative free memory to zero", () => {
      const free = calculateFreeMemoryForKv(80e9, 140e9, 8e9)
      expect(free).toBe(0)
    })

    it("calculates KV capacity with positional arguments", () => {
      // 4e9 bytes / 131072 bytes per token ≈ 30517 tokens
      const capacity = calculateKvCapacity(4e9, 131072)
      expect(capacity).toBe(30517)
    })

    it("calculates KV capacity with object arguments", () => {
      const capacity = calculateKvCapacity({
        totalGpuMemoryBytes: 160e9,
        weightMemoryBytes: 140e9,
        overheadBytes: 16e9,
        kvPerTokenBytes: 131072,
      })
      expect(capacity.tokens).toBe(30517)
      expect(capacity.freeMemoryBytes).toBe(4e9)
    })

    it("handles zero or negative inputs safely", () => {
      expect(calculateKvCapacity(0, 131072)).toBe(0)
      expect(calculateKvCapacity(4e9, 0)).toBe(0)
    })
  })

  describe("max concurrency", () => {
    it("calculates max concurrent requests from KV capacity and context length", () => {
      // 30517 tokens / 4096 context length = 7 concurrent requests
      expect(calculateMaxConcurrency(30517, 4096)).toBe(7)
    })

    it("returns 0 if context length is invalid or capacity is 0", () => {
      expect(calculateMaxConcurrency(0, 4096)).toBe(0)
      expect(calculateMaxConcurrency(30517, 0)).toBe(0)
    })
  })

  describe("evaluateMemoryFit", () => {
    it("verifies Llama-3-70B FP16 does NOT fit on 1x H100 80GB", () => {
      const result = evaluateMemoryFit({
        parameters: 70e9,
        precision: "FP16",
        gpuMemoryBytes: 80e9,
        gpuCount: 1,
        overheadFraction: 0.1,
      })
      expect(result.fits).toBe(false)
      expect(result.verdict).toContain("Does not fit")
      expect(result.verdict).toBe(
        "Does not fit: weights need 140 GB, but only 80 GB is available"
      )
    })

    it("verifies Llama-3-70B FP16 fits on 2x H100 80GB", () => {
      const result = evaluateMemoryFit({
        parameters: 70e9,
        precision: "FP16",
        gpuMemoryBytes: 80e9,
        gpuCount: 2,
        overheadFraction: 0.1,
      })
      expect(result.fits).toBe(true)
      expect(result.verdict).toBe("Fits")
      expect(result.totalGpuMemoryBytes).toBe(160e9)
      expect(result.freeMemoryBytes).toBe(4e9)
    })

    it("verifies Llama-3-8B FP16 fits on 1x A100 80GB", () => {
      const result = evaluateMemoryFit({
        parameters: 8e9,
        precision: "FP16",
        gpuMemoryBytes: 80e9,
        gpuCount: 1,
        overheadFraction: 0.1,
      })
      expect(result.fits).toBe(true)
      expect(result.verdict).toBe("Fits")
    })

    it("verifies model does NOT fit when weights exceed available memory after overhead", () => {
      // 75 GB weights fit in 80 GB GPU, but exceed 72 GB available after 8 GB overhead
      const result = evaluateMemoryFit({
        parameters: 37.5e9, // 37.5B * 2 bytes (FP16) = 75 GB
        precision: "FP16",
        gpuMemoryBytes: 80e9,
        gpuCount: 1,
        overheadBytes: 8e9,
      })
      expect(result.fits).toBe(false)
      expect(result.verdict).toBe(
        "Does not fit: weights need 75 GB, but only 72 GB is available after overhead"
      )
    })

    it("formats fractional memory values with decimal precision in fit verdicts", () => {
      // 8.2B params at FP16 = 16.4 GB weights on a 16 GB GPU
      const result = evaluateMemoryFit({
        parameters: 8.2e9,
        precision: "FP16",
        gpuMemoryBytes: 16e9,
        gpuCount: 1,
        overheadBytes: 1.6e9,
      })
      expect(result.fits).toBe(false)
      expect(result.verdict).toBe(
        "Does not fit: weights need 16.4 GB, but only 16 GB is available"
      )
    })
  })

  describe("formatting helpers", () => {
    it("formats bytes to GB and KB correctly", () => {
      expect(bytesToGb(140e9)).toBe("140.0")
      expect(bytesToGb(140 * BYTES_IN_GB, 0)).toBe("140")
      expect(bytesToKb(131072, 2)).toBe("131.07")
    })
  })

  describe("calculateMemoryBreakdown", () => {
    it("calculates segment sizes for a model that fits within GPU memory (Llama-3-70B FP16 on 2x H100)", () => {
      // 70B FP16 (140 GB weights) on 2x H100 (160 GB total), 10% overhead (16 GB)
      const result = calculateMemoryBreakdown({
        parameters: 70e9,
        precision: "FP16",
        totalGpuMemoryBytes: 160e9,
        overheadBytes: 16e9,
      })
      expect(result.overflow).toBe(false)
      expect(result.overflowGb).toBe(0)
      expect(result.overflowBytes).toBe(0)
      expect(result.weightsGb).toBe(140)
      expect(result.weightsBytes).toBe(140e9)
      expect(result.overheadGb).toBe(16)
      expect(result.overheadBytes).toBe(16e9)
      expect(result.freeKvGb).toBe(4) // 160 - 140 - 16 = 4 GB free
      expect(result.freeKvBytes).toBe(4e9)
      expect(result.totalGpuMemoryGb).toBe(160)
      expect(result.weightsPercent).toBeCloseTo(87.5, 1)
      expect(result.overheadPercent).toBeCloseTo(10, 1)
      expect(result.freeKvPercent).toBeCloseTo(2.5, 1)
      expect(result.overflowPercent).toBe(0)
      expect(result.segments).toHaveLength(3)
      expect(result.segments[0].id).toBe("weights")
      expect(result.segments[1].id).toBe("overhead")
      expect(result.segments[2].id).toBe("freeKv")
    })

    it("calculates overflow shortfall when weights and overhead exceed capacity (Llama-3-70B FP16 on 1x H100)", () => {
      // 70B FP16 (140 GB weights) on 1x H100 (80 GB total), 10% overhead (8 GB)
      const result = calculateMemoryBreakdown({
        parameters: 70e9,
        precision: "FP16",
        totalGpuMemoryBytes: 80e9,
        overheadBytes: 8e9,
      })
      expect(result.overflow).toBe(true)
      expect(result.overflowGb).toBe(68) // 140 + 8 - 80 = 68 GB shortfall
      expect(result.overflowBytes).toBe(68e9)
      expect(result.weightsGb).toBe(140)
      expect(result.overheadGb).toBe(8)
      expect(result.freeKvGb).toBe(0)
      expect(result.freeKvBytes).toBe(0)
      expect(result.totalGpuMemoryGb).toBe(80)
      expect(result.totalNeededGb).toBe(148)
      expect(result.weightsPercent).toBeCloseTo((80 / 148) * 100, 2)
      expect(result.overheadPercent).toBeCloseTo(0, 2)
      expect(result.overflowPercent).toBeCloseTo((68 / 148) * 100, 2)
      expect(result.segments).toHaveLength(3)
      expect(result.segments[0].id).toBe("weights")
      expect(result.segments[0].bytes).toBe(80e9)
      expect(result.segments[0].gb).toBe(80)
      expect(result.segments[0].percentage).toBeCloseTo((80 / 148) * 100, 2)
      expect(result.segments[1].id).toBe("overhead")
      expect(result.segments[1].bytes).toBe(0)
      expect(result.segments[1].gb).toBe(0)
      expect(result.segments[1].percentage).toBeCloseTo(0, 2)
      expect(result.segments[2].id).toBe("overflow")
      expect(result.segments[2].bytes).toBe(68e9)
      expect(result.segments[2].gb).toBe(68)
      expect(result.segments[2].percentage).toBeCloseTo((68 / 148) * 100, 2)

      // Segments must form a clean partition summing to totalNeededBytes and 100%
      const totalPercent = result.segments.reduce((acc, s) => acc + s.percentage, 0)
      expect(totalPercent).toBeCloseTo(100, 1)
      const totalBytes = result.segments.reduce((acc, s) => acc + s.bytes, 0)
      expect(totalBytes).toBe(148e9)
    })

    it("calculates overflow shortfall with zero overhead (140 GB weights on 80 GB -> 60 GB over)", () => {
      const result = calculateMemoryBreakdown({
        weightMemoryBytes: 140e9,
        totalGpuMemoryBytes: 80e9,
        overheadBytes: 0,
      })
      expect(result.overflow).toBe(true)
      expect(result.overflowGb).toBe(60) // 140 - 80 = 60 GB shortfall
      expect(result.freeKvGb).toBe(0)
      expect(result.weightsPercent).toBeCloseTo((80 / 140) * 100, 2)
      expect(result.overheadPercent).toBe(0)
      expect(result.overflowPercent).toBeCloseTo((60 / 140) * 100, 2)
      const totalPercent = result.segments.reduce((acc, s) => acc + s.percentage, 0)
      expect(totalPercent).toBeCloseTo(100, 1)
      const totalBytes = result.segments.reduce((acc, s) => acc + s.bytes, 0)
      expect(totalBytes).toBe(140e9)
    })

    it("calculates overflow when weights fit alone but weights + overhead exceed capacity", () => {
      // 75 GB weights fits in 80 GB, but with 8 GB overhead needs 83 GB -> 3 GB over
      const result = calculateMemoryBreakdown({
        weightBytes: 75e9,
        totalGpuMemoryBytes: 80e9,
        overheadBytes: 8e9,
      })
      expect(result.overflow).toBe(true)
      expect(result.overflowGb).toBe(3)
      expect(result.freeKvGb).toBe(0)
      expect(result.weightsPercent).toBeCloseTo((75 / 83) * 100, 2)
      expect(result.overheadPercent).toBeCloseTo((5 / 83) * 100, 2)
      expect(result.overflowPercent).toBeCloseTo((3 / 83) * 100, 2)
      expect(result.segments[0].bytes).toBe(75e9)
      expect(result.segments[1].bytes).toBe(5e9)
      expect(result.segments[2].bytes).toBe(3e9)
      const totalPercent = result.segments.reduce((acc, s) => acc + s.percentage, 0)
      expect(totalPercent).toBeCloseTo(100, 1)
      const totalBytes = result.segments.reduce((acc, s) => acc + s.bytes, 0)
      expect(totalBytes).toBe(83e9)
    })

    it("returns 0 total GPU memory when gpuCount is explicitly 0", () => {
      const result = calculateMemoryBreakdown({
        gpuCount: 0,
        gpuMemoryBytes: 80e9,
        weightMemoryBytes: 16e9,
      })
      expect(result.totalGpuMemoryBytes).toBe(0)
      expect(result.totalGpuMemoryGb).toBe(0)
      expect(result.overflow).toBe(true)
      expect(result.overflowGb).toBe(16)
      expect(result.overflowPercent).toBe(100)
      expect(result.weightsPercent).toBe(0)
    })

    it("calculates breakdown for Llama-3-8B FP16 on 1x A100 (80 GB)", () => {
      // 8B FP16 = 16 GB weights, 8 GB overhead -> 56 GB free for KV cache
      const result = calculateMemoryBreakdown({
        parameters: 8e9,
        precision: "FP16",
        gpuMemoryBytes: 80e9,
        gpuCount: 1,
        overheadFraction: 0.1,
      })
      expect(result.overflow).toBe(false)
      expect(result.overflowGb).toBe(0)
      expect(result.weightsGb).toBe(16)
      expect(result.overheadGb).toBe(8)
      expect(result.freeKvGb).toBe(56)
      expect(result.totalGpuMemoryGb).toBe(80)
    })

    it("supports positional argument overload", () => {
      const fitResult = calculateMemoryBreakdown(160e9, 140e9, 16e9)
      expect(fitResult.overflow).toBe(false)
      expect(fitResult.freeKvGb).toBe(4)

      const overflowResult = calculateMemoryBreakdown(80e9, 140e9, 8e9)
      expect(overflowResult.overflow).toBe(true)
      expect(overflowResult.overflowGb).toBe(68)
      expect(overflowResult.freeKvGb).toBe(0)
    })

    it("handles zero or empty capacity gracefully", () => {
      const zeroResult = calculateMemoryBreakdown({
        totalGpuMemoryBytes: 0,
        weightMemoryBytes: 0,
        overheadBytes: 0,
      })
      expect(zeroResult.overflow).toBe(false)
      expect(zeroResult.overflowGb).toBe(0)
      expect(zeroResult.freeKvGb).toBe(0)
      expect(zeroResult.weightsPercent).toBe(0)
    })
  })

  describe("GPU presets specifications", () => {
    it("includes vendor-spec peak TFLOPS and memory bandwidth for A100 80GB", () => {
      const a100 = GPU_PRESETS.find((p) => p.id === "a100-80gb")
      expect(a100).toBeDefined()
      expect(a100?.memoryGb).toBe(80)
      // NVIDIA A100 SXM4: 312 TFLOPS dense FP16/BF16, 2.0 TB/s (2,039 GB/s)
      expect(a100?.peakTflops).toBe(312)
      expect(a100?.memoryBandwidthTb).toBe(2.0)
    })

    it("includes vendor-spec peak TFLOPS and memory bandwidth for H100 80GB SXM", () => {
      const h100 = GPU_PRESETS.find((p) => p.id === "h100-80gb")
      expect(h100).toBeDefined()
      expect(h100?.memoryGb).toBe(80)
      // NVIDIA H100 SXM5: 989 TFLOPS dense FP16/BF16, 3.35 TB/s (3,350 GB/s)
      expect(h100?.peakTflops).toBe(989)
      expect(h100?.memoryBandwidthTb).toBe(3.35)
    })

    it("includes vendor-spec peak TFLOPS and memory bandwidth for L40S 48GB", () => {
      const l40s = GPU_PRESETS.find((p) => p.id === "l40s-48gb")
      expect(l40s).toBeDefined()
      expect(l40s?.memoryGb).toBe(48)
      // NVIDIA L40S: 366 TFLOPS dense FP16/BF16, 0.864 TB/s (864 GB/s)
      expect(l40s?.peakTflops).toBe(366)
      expect(l40s?.memoryBandwidthTb).toBe(0.864)
    })
  })

  describe("estimatePrefillTime", () => {
    it("calculates prefill time for 8B model with default compute utilization (0.5)", () => {
      // Formula: 2 * params * prompt_tokens / (peak_FLOPS * GPUs * utilization)
      // Arithmetic:
      //   Total FLOPs = 2 * 8e9 params * 1024 prompt tokens = 1.6384e13 FLOPs
      //   Effective FLOPs = 989e12 peak FLOPS * 1 GPU * 0.5 default utilization = 4.945e14 FLOPS
      //   Prefill time = 1.6384e13 / 4.945e14 ≈ 0.033132457s (~33.13 ms)
      const prefillSeconds = estimatePrefillTime({
        parameters: 8e9,
        promptTokens: 1024,
        peakFlops: 989e12,
        gpuCount: 1,
      })
      expect(prefillSeconds).toBeCloseTo(0.03313, 4)
    })

    it("calculates prefill time with custom compute utilization", () => {
      // Arithmetic:
      //   Total FLOPs = 2 * 8e9 * 1024 = 1.6384e13 FLOPs
      //   Effective FLOPs = 989e12 * 1 * 0.6 utilization = 5.934e14 FLOPS
      //   Prefill time = 1.6384e13 / 5.934e14 ≈ 0.02761038s (~27.61 ms)
      const prefillSeconds = estimatePrefillTime({
        parameters: 8e9,
        promptTokens: 1024,
        peakFlops: 989e12,
        gpuCount: 1,
        computeUtilization: 0.6,
      })
      expect(prefillSeconds).toBeCloseTo(0.02761, 4)
    })

    it("scales prefill time inversely with GPU count for multi-GPU setups", () => {
      // 70B model on 4x H100 (989 TFLOPS each), 2048 prompt tokens, 0.5 utilization:
      // Arithmetic:
      //   Total FLOPs = 2 * 70e9 * 2048 = 2.8672e14 FLOPs
      //   Effective FLOPs = 989e12 * 4 GPUs * 0.5 = 1.978e15 FLOPS
      //   Prefill time = 2.8672e14 / 1.978e15 ≈ 0.1449545s (~144.95 ms)
      const prefillSeconds = estimatePrefillTime({
        parameters: 70e9,
        promptTokens: 2048,
        peakFlops: 989e12,
        gpuCount: 4,
        computeUtilization: 0.5,
      })
      expect(prefillSeconds).toBeCloseTo(0.14495, 4)
    })

    it("accepts peakTflops in place of raw peakFlops", () => {
      // 989 peakTflops -> 989e12 FLOPS
      const prefillSeconds = estimatePrefillTime({
        parameters: 8e9,
        promptTokens: 1024,
        peakTflops: 989,
      })
      expect(prefillSeconds).toBeCloseTo(0.03313, 4)
    })

    it("supports positional argument overload", () => {
      // estimatePrefillTime(parameters, promptTokens, peakFlops, gpuCount, computeUtilization)
      const prefillSeconds = estimatePrefillTime(8e9, 1024, 989e12, 1, 0.5)
      expect(prefillSeconds).toBeCloseTo(0.03313, 4)
    })

    it("handles zero or non-positive inputs safely", () => {
      expect(estimatePrefillTime({ parameters: 0, promptTokens: 1024, peakFlops: 989e12 })).toBe(0)
      expect(estimatePrefillTime({ parameters: 8e9, promptTokens: 0, peakFlops: 989e12 })).toBe(0)
      expect(estimatePrefillTime({ parameters: 8e9, promptTokens: 1024, peakFlops: 0 })).toBe(0)
      expect(estimatePrefillTime({ parameters: 8e9, promptTokens: 1024, peakFlops: 989e12, computeUtilization: 0 })).toBe(0)
      expect(estimatePrefillTime({ parameters: 8e9, promptTokens: 1024, peakFlops: 989e12, gpuCount: 0 })).toBe(0)
      expect(estimatePrefillTime({ parameters: 8e9, promptTokens: 1024, peakFlops: 989e12, gpuCount: -1 })).toBe(0)
      expect(estimatePrefillTime(8e9, 1024, 989e12, 0)).toBe(0)
    })

    it("exports DEFAULT_COMPUTE_UTILIZATION as 0.5", () => {
      expect(DEFAULT_COMPUTE_UTILIZATION).toBe(0.5)
    })
  })

  describe("estimateDecodeStepTime", () => {
    it("calculates decode step time with default bandwidth utilization (0.7)", () => {
      // Formula: (weight_bytes + KV_bytes_read) / (bandwidth * GPUs * utilization)
      // Arithmetic:
      //   Weights = 16 GB = 16e9 bytes (8B FP16)
      //   KV read for batch = 0.4 GB = 0.4e9 bytes
      //   Total bytes read = 16.4e9 bytes
      //   Effective bandwidth = 2.0e12 B/s * 1 GPU * 0.7 default utilization = 1.4e12 B/s
      //   Step time = 16.4e9 / 1.4e12 ≈ 0.011714286s (~11.71 ms)
      const stepSeconds = estimateDecodeStepTime({
        weightBytes: 16e9,
        kvBytesRead: 0.4e9,
        memoryBandwidthBytesPerSec: 2.0e12,
        gpuCount: 1,
      })
      expect(stepSeconds).toBeCloseTo(0.01171, 4)
    })

    it("calculates decode step time with custom bandwidth utilization", () => {
      // Arithmetic:
      //   Total bytes read = 16.4e9 bytes
      //   Effective bandwidth = 2.0e12 B/s * 1 GPU * 0.8 utilization = 1.6e12 B/s
      //   Step time = 16.4e9 / 1.6e12 = 0.01025s (10.25 ms)
      const stepSeconds = estimateDecodeStepTime({
        weightBytes: 16e9,
        kvBytesRead: 0.4e9,
        memoryBandwidthBytesPerSec: 2.0e12,
        gpuCount: 1,
        bandwidthUtilization: 0.8,
      })
      expect(stepSeconds).toBeCloseTo(0.01025, 5)
    })

    it("scales decode bandwidth across multiple GPUs", () => {
      // 70B model (140 GB weights) + 1 GB KV read on 2x H100 (3.35 TB/s each), 0.7 utilization:
      // Arithmetic:
      //   Total bytes = 141e9 bytes
      //   Effective bandwidth = 3.35e12 B/s * 2 GPUs * 0.7 = 4.69e12 B/s
      //   Step time = 141e9 / 4.69e12 ≈ 0.030063966s (~30.06 ms)
      const stepSeconds = estimateDecodeStepTime({
        weightBytes: 140e9,
        kvBytesRead: 1e9,
        memoryBandwidthBytesPerSec: 3.35e12,
        gpuCount: 2,
        bandwidthUtilization: 0.7,
      })
      expect(stepSeconds).toBeCloseTo(0.03006, 4)
    })

    it("accepts memoryBandwidthTb in place of memoryBandwidthBytesPerSec", () => {
      // 2.0 TB/s -> 2.0e12 B/s
      const stepSeconds = estimateDecodeStepTime({
        weightBytes: 16e9,
        kvBytesRead: 0.4e9,
        memoryBandwidthTb: 2.0,
      })
      expect(stepSeconds).toBeCloseTo(0.01171, 4)
    })

    it("supports positional argument overload", () => {
      // estimateDecodeStepTime(weightBytes, kvBytesRead, memoryBandwidthBytesPerSec, gpuCount, bandwidthUtilization)
      const stepSeconds = estimateDecodeStepTime(16e9, 0.4e9, 2.0e12, 1, 0.7)
      expect(stepSeconds).toBeCloseTo(0.01171, 4)
    })

    it("handles zero or non-positive inputs safely", () => {
      expect(estimateDecodeStepTime({ weightBytes: 0, kvBytesRead: 0, memoryBandwidthBytesPerSec: 2.0e12 })).toBe(0)
      expect(estimateDecodeStepTime({ weightBytes: 16e9, kvBytesRead: 0.4e9, memoryBandwidthBytesPerSec: 0 })).toBe(0)
      expect(estimateDecodeStepTime({ weightBytes: 16e9, kvBytesRead: 0.4e9, memoryBandwidthBytesPerSec: 2.0e12, bandwidthUtilization: 0 })).toBe(0)
      expect(estimateDecodeStepTime({ weightBytes: 16e9, kvBytesRead: 0.4e9, memoryBandwidthBytesPerSec: 2.0e12, gpuCount: 0 })).toBe(0)
      expect(estimateDecodeStepTime({ weightBytes: 16e9, kvBytesRead: 0.4e9, memoryBandwidthBytesPerSec: 2.0e12, gpuCount: -1 })).toBe(0)
      expect(estimateDecodeStepTime(16e9, 0.4e9, 2.0e12, 0)).toBe(0)
    })

    it("exports DEFAULT_BANDWIDTH_UTILIZATION as 0.7", () => {
      expect(DEFAULT_BANDWIDTH_UTILIZATION).toBe(0.7)
    })
  })

  describe("estimateDecodeTokensPerSecond", () => {
    it("computes per-request and aggregate tokens per second for batch size 1", () => {
      // Step time = 0.0115s (~11.5 ms per step)
      // Arithmetic:
      //   per-request = 1 / 0.0115 ≈ 86.9565 tokens/s
      //   aggregate = 1 / 0.0115 ≈ 86.9565 tokens/s
      const throughput = estimateDecodeTokensPerSecond({
        stepTimeSeconds: 0.0115,
        batchSize: 1,
      })
      expect(throughput.perRequestTokensPerSecond).toBeCloseTo(86.9565, 3)
      expect(throughput.aggregateTokensPerSecond).toBeCloseTo(86.9565, 3)
    })

    it("demonstrates that a larger batch increases aggregate tokens/s while per-request tokens/s decreases", () => {
      // Realistic simulation: Llama-3-8B FP16 (16 GB weights) on 1x A100 (2.0 TB/s, 0.7 utilization -> 1.4 TB/s effective)
      // Each request has context length of 1024 tokens.
      // KV cache per token for Llama-3-8B FP16 = 131,072 bytes.
      //
      // Batch size 1:
      //   KV read = 1 request * 1024 tokens * 131,072 bytes = 134,217,728 bytes (~0.134 GB)
      //   Total bytes = 16e9 + 134,217,728 = 16,134,217,728 bytes
      //   Step time = 16,134,217,728 / 1.4e12 ≈ 0.01152444s (~11.52 ms)
      const stepTimeBatch1 = estimateDecodeStepTime({
        weightBytes: 16e9,
        kvBytesRead: 1 * 1024 * 131072,
        memoryBandwidthBytesPerSec: 2.0e12,
        gpuCount: 1,
        bandwidthUtilization: 0.7,
      })
      const tput1 = estimateDecodeTokensPerSecond({
        stepTimeSeconds: stepTimeBatch1,
        batchSize: 1,
      })
      // Arithmetic:
      //   perRequestTokensPerSecond ≈ 1 / 0.01152444 ≈ 86.77 tokens/s
      //   aggregateTokensPerSecond ≈ 1 / 0.01152444 ≈ 86.77 tokens/s
      expect(tput1.perRequestTokensPerSecond).toBeCloseTo(86.77, 1)
      expect(tput1.aggregateTokensPerSecond).toBeCloseTo(86.77, 1)

      // Batch size 8:
      //   KV read = 8 requests * 1024 tokens * 131,072 bytes = 1,073,741,824 bytes (~1.074 GB)
      //   Total bytes = 16e9 + 1,073,741,824 = 17,073,741,824 bytes
      //   Step time = 17,073,741,824 / 1.4e12 ≈ 0.01219553s (~12.20 ms)
      const stepTimeBatch8 = estimateDecodeStepTime({
        weightBytes: 16e9,
        kvBytesRead: 8 * 1024 * 131072,
        memoryBandwidthBytesPerSec: 2.0e12,
        gpuCount: 1,
        bandwidthUtilization: 0.7,
      })
      const tput8 = estimateDecodeTokensPerSecond({
        stepTimeSeconds: stepTimeBatch8,
        batchSize: 8,
      })
      // Arithmetic:
      //   perRequestTokensPerSecond ≈ 1 / 0.01219553 ≈ 82.00 tokens/s (~5.5% slower per user)
      //   aggregateTokensPerSecond ≈ 8 / 0.01219553 ≈ 655.98 tokens/s (~7.5x higher total throughput)
      expect(tput8.perRequestTokensPerSecond).toBeCloseTo(82.00, 1)
      expect(tput8.aggregateTokensPerSecond).toBeCloseTo(655.98, 1)

      // Key physical properties required:
      // 1. Larger batch increases aggregate tokens/s
      expect(tput8.aggregateTokensPerSecond).toBeGreaterThan(tput1.aggregateTokensPerSecond)
      // 2. Larger batch decreases per-request tokens/s
      expect(tput8.perRequestTokensPerSecond).toBeLessThan(tput1.perRequestTokensPerSecond)
    })

    it("defaults batchSize to 1 if omitted", () => {
      const throughput = estimateDecodeTokensPerSecond({
        stepTimeSeconds: 0.01,
      })
      expect(throughput.perRequestTokensPerSecond).toBe(100)
      expect(throughput.aggregateTokensPerSecond).toBe(100)
    })

    it("supports positional argument overload", () => {
      // estimateDecodeTokensPerSecond(stepTimeSeconds, batchSize)
      const throughput = estimateDecodeTokensPerSecond(0.02, 4)
      // Arithmetic: per-request = 1 / 0.02 = 50 tokens/s; aggregate = 4 / 0.02 = 200 tokens/s
      expect(throughput.perRequestTokensPerSecond).toBe(50)
      expect(throughput.aggregateTokensPerSecond).toBe(200)
    })

    it("handles zero or non-positive step time safely", () => {
      const throughputZero = estimateDecodeTokensPerSecond({ stepTimeSeconds: 0, batchSize: 4 })
      expect(throughputZero.perRequestTokensPerSecond).toBe(0)
      expect(throughputZero.aggregateTokensPerSecond).toBe(0)

      const throughputNeg = estimateDecodeTokensPerSecond({ stepTimeSeconds: -0.01, batchSize: 4 })
      expect(throughputNeg.perRequestTokensPerSecond).toBe(0)
      expect(throughputNeg.aggregateTokensPerSecond).toBe(0)
    })

    it("handles zero or non-positive batch size safely", () => {
      const throughput = estimateDecodeTokensPerSecond({ stepTimeSeconds: 0.01, batchSize: 0 })
      expect(throughput.perRequestTokensPerSecond).toBe(0)
      expect(throughput.aggregateTokensPerSecond).toBe(0)
    })
  })
})
