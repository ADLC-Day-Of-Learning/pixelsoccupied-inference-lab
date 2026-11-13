import { describe, it, expect } from "vitest"
import {
  calculateWeightMemory,
  calculateKvCachePerToken,
  calculateFreeMemoryForKv,
  calculateKvCapacity,
  calculateMaxConcurrency,
  evaluateMemoryFit,
  bytesToGb,
  bytesToKb,
  BYTES_IN_GB,
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
})
