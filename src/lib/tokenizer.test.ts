import { describe, it, expect } from "vitest"
import {
  tokenize,
  countCharacters,
  countWords,
  countTokens,
  computeTokenizerStats,
  isSingleWord,
  checkSentenceChallenge,
  checkWordChallenge,
  SAMPLE_PRESETS,
} from "./tokenizer"

describe("src/lib/tokenizer.ts", () => {
  describe("tokenize", () => {
    it("returns an empty array for empty string", () => {
      expect(tokenize("")).toEqual([])
    })

    it("splits 'Inference is fun!' into expected token chunks with IDs", () => {
      const tokens = tokenize("Inference is fun!")
      expect(tokens.map((t) => t.text)).toEqual(["Inference", " is", " fun", "!"])
      expect(tokens.every((t) => typeof t.id === "number" && t.id > 0)).toBe(true)
    })

    it("performs greedy longest-match on known vocabulary words with leading spaces", () => {
      const tokens = tokenize("Large language models process text")
      expect(tokens.map((t) => t.text)).toEqual([
        "Large",
        " language",
        " models",
        " process",
        " text",
      ])
    })

    it("falls back to character tokens for numbers, symbols, and non-vocabulary text", () => {
      const numberTokens = tokenize("12345")
      expect(numberTokens.map((t) => t.text)).toEqual(["1", "2", "3", "4", "5"])
      expect(numberTokens).toHaveLength(5)

      const unicodeTokens = tokenize("你好世界")
      expect(unicodeTokens.map((t) => t.text)).toEqual(["你", "好", "世", "界"])
      expect(unicodeTokens).toHaveLength(4)
    })

    it("splits code snippets into syntax tokens and identifiers", () => {
      const codeTokens = tokenize("def add(x, y):")
      expect(codeTokens.length).toBeGreaterThanOrEqual(6)
    })
  })

  describe("countCharacters", () => {
    it("counts characters accurately", () => {
      expect(countCharacters("")).toBe(0)
      expect(countCharacters("Inference")).toBe(9)
      expect(countCharacters("Inference is fun!")).toBe(17)
    })
  })

  describe("countWords", () => {
    it("returns 0 for empty or whitespace-only strings", () => {
      expect(countWords("")).toBe(0)
      expect(countWords("   \t\n  ")).toBe(0)
    })

    it("counts words separated by spaces or tabs accurately", () => {
      expect(countWords("hello world")).toBe(2)
      expect(countWords("  the   quick brown fox jumps over the lazy dog  ")).toBe(9)
    })
  })

  describe("countTokens", () => {
    it("matches tokenize length", () => {
      const text = "Inference is fun!"
      expect(countTokens(text)).toBe(tokenize(text).length)
      expect(countTokens("")).toBe(0)
    })
  })

  describe("computeTokenizerStats", () => {
    it("computes live character, word, token counts and ratio", () => {
      const stats = computeTokenizerStats("Inference is fun!")
      expect(stats.characters).toBe(17)
      expect(stats.words).toBe(3)
      expect(stats.tokens).toBe(4)
      expect(stats.charsPerToken).toBeCloseTo(17 / 4, 1)
    })

    it("handles empty string gracefully without division by zero", () => {
      const stats = computeTokenizerStats("")
      expect(stats).toEqual({
        characters: 0,
        words: 0,
        tokens: 0,
        charsPerToken: 0,
      })
    })
  })

  describe("isSingleWord", () => {
    it("returns true for a single word without spaces", () => {
      expect(isSingleWord("antidisestablishmentarianism")).toBe(true)
      expect(isSingleWord("inference")).toBe(true)
      expect(isSingleWord("  token  ")).toBe(true)
    })

    it("returns false for empty, whitespace, or multi-word strings", () => {
      expect(isSingleWord("")).toBe(false)
      expect(isSingleWord("   ")).toBe(false)
      expect(isSingleWord("two words")).toBe(false)
    })
  })

  describe("checkSentenceChallenge", () => {
    it("passes when sentence has >= 8 words and <= 10 tokens", () => {
      // 9 words, 10 tokens
      const result = checkSentenceChallenge("The quick brown fox jumps over the lazy dog.")
      expect(result.wordCount).toBe(9)
      expect(result.tokenCount).toBeLessThanOrEqual(10)
      expect(result.passes).toBe(true)

      // 8 words, 8 tokens
      const result2 = checkSentenceChallenge("This is a test that works very well")
      expect(result2.wordCount).toBe(8)
      expect(result2.tokenCount).toBeLessThanOrEqual(10)
      expect(result2.passes).toBe(true)
    })

    it("fails when sentence has fewer than 8 words", () => {
      const result = checkSentenceChallenge("Inference is fun and fast")
      expect(result.wordCount).toBe(5)
      expect(result.passes).toBe(false)
    })

    it("fails when sentence has more than 10 tokens even if >= 8 words", () => {
      // Using rare/uncommon words or numbers that split into many tokens
      const result = checkSentenceChallenge(
        "Xylophone quartz zephyr phantom rhythm sphinx antidisestablishmentarianism pterodactyl"
      )
      expect(result.wordCount).toBe(8)
      expect(result.tokenCount).toBeGreaterThan(10)
      expect(result.passes).toBe(false)
    })

    it("handles leading and trailing whitespace without falsely inflating token count", () => {
      const result = checkSentenceChallenge(
        "  The quick brown fox jumps over the lazy dog.  "
      )
      expect(result.wordCount).toBe(9)
      expect(result.tokenCount).toBeLessThanOrEqual(10)
      expect(result.passes).toBe(true)

      const emptyResult = checkSentenceChallenge("   ")
      expect(emptyResult.wordCount).toBe(0)
      expect(emptyResult.tokenCount).toBe(0)
      expect(emptyResult.passes).toBe(false)
    })
  })

  describe("checkWordChallenge", () => {
    it("passes for a single word that splits into >= 4 tokens", () => {
      const result = checkWordChallenge("antidisestablishmentarianism")
      expect(result.isSingleWord).toBe(true)
      expect(result.tokenCount).toBeGreaterThanOrEqual(4)
      expect(result.passes).toBe(true)

      const result2 = checkWordChallenge("supercalifragilistic")
      expect(result2.isSingleWord).toBe(true)
      expect(result2.tokenCount).toBeGreaterThanOrEqual(4)
      expect(result2.passes).toBe(true)
    })

    it("fails for a word that splits into fewer than 4 tokens", () => {
      const result = checkWordChallenge("dog")
      expect(result.isSingleWord).toBe(true)
      expect(result.tokenCount).toBe(1)
      expect(result.passes).toBe(false)

      const result2 = checkWordChallenge("Inference")
      expect(result2.isSingleWord).toBe(true)
      expect(result2.tokenCount).toBe(1)
      expect(result2.passes).toBe(false)
    })

    it("fails if multiple words are provided even if total tokens >= 4", () => {
      const result = checkWordChallenge("four different small words")
      expect(result.isSingleWord).toBe(false)
      expect(result.passes).toBe(false)
    })
  })

  describe("SAMPLE_PRESETS and helpers", () => {
    it("provides expected sample presets", () => {
      expect(SAMPLE_PRESETS.length).toBeGreaterThanOrEqual(4)
      expect(SAMPLE_PRESETS.map((p) => p.id)).toContain("sample")
      expect(SAMPLE_PRESETS.map((p) => p.id)).toContain("rare")
      expect(SAMPLE_PRESETS.map((p) => p.id)).toContain("numbers")
      expect(SAMPLE_PRESETS.map((p) => p.id)).toContain("code")
    })
  })
})
