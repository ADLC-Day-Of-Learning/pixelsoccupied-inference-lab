/**
 * Pure, deterministic toy tokenizer for Inference Lab Play Level 0.
 *
 * Implements a greedy longest-match tokenization algorithm over a compact
 * hardcoded vocabulary of common English words, subwords, and characters,
 * falling back to single characters for rare words, numbers, code, and symbols.
 *
 * Real LLM tokenizers (BPE / WordPiece) operate on much larger vocabularies
 * (32k-128k tokens) learned from corpus statistics, but share this same
 * fundamental behavior: frequent strings compress into single tokens,
 * while rare words, numbers, and code split into multiple smaller tokens.
 */

export interface Token {
  id: number
  text: string
}

export interface TokenizerStats {
  characters: number
  words: number
  tokens: number
  charsPerToken: number
}

export interface SentenceChallengeResult {
  passes: boolean
  wordCount: number
  tokenCount: number
}

export interface WordChallengeResult {
  passes: boolean
  isSingleWord: boolean
  tokenCount: number
}

export interface SamplePreset {
  id: string
  label: string
  text: string
  description: string
}

/**
 * Base single ASCII characters (printable chars + space, tab, newline).
 */
const ASCII_CHARS: string[] = []
for (let c = 32; c <= 126; c++) {
  ASCII_CHARS.push(String.fromCharCode(c))
}
ASCII_CHARS.push("\t", "\n")

/**
 * Common English words included in the toy vocabulary.
 */
const COMMON_WORDS = [
  "the",
  "The",
  "be",
  "to",
  "of",
  "and",
  "a",
  "in",
  "that",
  "That",
  "have",
  "it",
  "It",
  "for",
  "not",
  "on",
  "with",
  "he",
  "as",
  "you",
  "You",
  "do",
  "at",
  "this",
  "This",
  "but",
  "his",
  "by",
  "from",
  "they",
  "They",
  "we",
  "We",
  "say",
  "her",
  "she",
  "or",
  "an",
  "will",
  "my",
  "one",
  "all",
  "would",
  "there",
  "their",
  "what",
  "so",
  "up",
  "out",
  "if",
  "about",
  "who",
  "get",
  "which",
  "go",
  "me",
  "when",
  "make",
  "can",
  "like",
  "time",
  "no",
  "just",
  "him",
  "know",
  "take",
  "people",
  "into",
  "year",
  "your",
  "good",
  "some",
  "could",
  "them",
  "see",
  "other",
  "than",
  "then",
  "now",
  "look",
  "only",
  "come",
  "its",
  "over",
  "think",
  "also",
  "back",
  "after",
  "use",
  "uses",
  "two",
  "how",
  "our",
  "work",
  "first",
  "well",
  "way",
  "even",
  "new",
  "want",
  "because",
  "any",
  "these",
  "give",
  "day",
  "most",
  "us",
  "write",
  "Write",
  "sentence",
  "words",
  "word",
  "least",
  "find",
  "Find",
  "splits",
  "more",
  "four",
  "eight",
  "ten",
  "quick",
  "brown",
  "fox",
  "jumps",
  "lazy",
  "dog",
  "models",
  "model",
  "process",
  "text",
  "large",
  "Large",
  "language",
  "inference",
  "Inference",
  "fun",
  "is",
  "simple",
  "test",
  "works",
  "very",
  "token",
  "tokens",
  "cost",
  "speed",
  "memory",
  "cheap",
  "expensive",
  "rule",
  "thumb",
  "scales",
  "common",
  "rare",
  "strings",
  "hello",
  "world",
]

/**
 * Common subwords and morphemes.
 */
const COMMON_SUBWORDS = [
  "ing",
  "ed",
  "tion",
  "ly",
  "er",
  "es",
  "al",
  "ment",
  "able",
  "ive",
  "ize",
  "ate",
  "ic",
  "ness",
  "ity",
  "un",
  "re",
  "dis",
  "anti",
  "pre",
  "non",
  "sub",
  "th",
  "he",
  "an",
  "er",
  "on",
  "nd",
  "ha",
  "at",
  "en",
  "of",
  "or",
  "nt",
  "ea",
  "ti",
  "to",
  "it",
  "st",
  "io",
  "le",
  "is",
  "ou",
  "ar",
  "as",
  "de",
  "rt",
  "ve",
  "ch",
  "sh",
  "ph",
]

/**
 * Assemble vocabulary list with consistent deterministic IDs.
 * Words are included both unspaced and with a leading space (as in BPE).
 */
function buildVocabulary(): { map: Map<string, number>; maxLength: number } {
  const tokenSet = new Set<string>()

  // 1. Single ASCII characters
  for (const ch of ASCII_CHARS) {
    tokenSet.add(ch)
  }

  // 2. Common words (both unspaced and with leading space)
  for (const word of COMMON_WORDS) {
    tokenSet.add(word)
    tokenSet.add(` ${word}`)
  }

  // 3. Subwords
  for (const sub of COMMON_SUBWORDS) {
    tokenSet.add(sub)
  }

  const map = new Map<string, number>()
  let id = 1
  let maxLength = 1

  for (const tok of tokenSet) {
    map.set(tok, id++)
    if (tok.length > maxLength) {
      maxLength = tok.length
    }
  }

  return { map, maxLength }
}

const { map: VOCAB_MAP, maxLength: MAX_TOKEN_LEN } = buildVocabulary()

/**
 * Tokenize input text using greedy longest-match against the built-in vocabulary.
 * Falls back to single characters for unknown character sequences.
 */
export function tokenize(text: string): Token[] {
  if (!text) {
    return []
  }

  const tokens: Token[] = []
  let i = 0

  while (i < text.length) {
    let matched = false
    const maxLookahead = Math.min(MAX_TOKEN_LEN, text.length - i)

    // Greedy longest-match: check longest candidate tokens first down to length 2
    for (let len = maxLookahead; len >= 2; len--) {
      const candidate = text.slice(i, i + len)
      const id = VOCAB_MAP.get(candidate)
      if (id !== undefined) {
        tokens.push({ id, text: candidate })
        i += len
        matched = true
        break
      }
    }

    if (!matched) {
      // Fallback: single character (safely handle surrogate code points)
      const codePoint = text.codePointAt(i) ?? text.charCodeAt(i)
      const char = String.fromCodePoint(codePoint)
      const id =
        VOCAB_MAP.get(char) ??
        (codePoint < 1000 ? codePoint : 1000 + (codePoint % 9000))

      tokens.push({ id, text: char })
      i += char.length
    }
  }

  return tokens
}

/**
 * Counts total characters in text.
 */
export function countCharacters(text: string): number {
  return text.length
}

/**
 * Counts whitespace-delimited words in text.
 */
export function countWords(text: string): number {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return 0
  }
  return trimmed.split(/\s+/).length
}

/**
 * Counts total tokens produced by tokenizing text.
 */
export function countTokens(text: string): number {
  return tokenize(text).length
}

/**
 * Computes character, word, and token summary metrics.
 */
export function computeTokenizerStats(text: string): TokenizerStats {
  const characters = countCharacters(text)
  const words = countWords(text)
  const tokens = countTokens(text)
  const charsPerToken =
    tokens > 0 ? Number((characters / tokens).toFixed(1)) : 0

  return {
    characters,
    words,
    tokens,
    charsPerToken,
  }
}

/**
 * Determines whether the given string is a non-empty single word (no internal whitespace).
 */
export function isSingleWord(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return false
  }
  return trimmed.split(/\s+/).length === 1
}

/**
 * Evaluates Challenge 1:
 * "Write a sentence of at least 8 words that uses at most 10 tokens."
 */
export function checkSentenceChallenge(text: string): SentenceChallengeResult {
  const trimmed = text.trim()
  const wordCount = countWords(trimmed)
  const tokenCount = countTokens(trimmed)
  const passes = wordCount >= 8 && tokenCount <= 10

  return {
    passes,
    wordCount,
    tokenCount,
  }
}

/**
 * Evaluates Challenge 2:
 * "Find a word that splits into 4 or more tokens."
 */
export function checkWordChallenge(text: string): WordChallengeResult {
  const isSingle = isSingleWord(text)
  const tokenCount = countTokens(text.trim())
  const passes = isSingle && tokenCount >= 4

  return {
    passes,
    isSingleWord: isSingle,
    tokenCount,
  }
}

/**
 * Presets for Try sandbox demonstrating various tokenization behaviors.
 */
export const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: "sample",
    label: "Sample Sentence",
    text: "Inference is fun! Large language models process text as tokens.",
    description: "Common English words compress efficiently into 1 token each.",
  },
  {
    id: "rare",
    label: "Rare Word",
    text: "antidisestablishmentarianism",
    description: "Uncommon words split into many smaller subword tokens.",
  },
  {
    id: "numbers",
    label: "Numbers",
    text: "123456789 + 987654321 = 1111111110",
    description: "Numbers typically split digit-by-digit or in small clusters.",
  },
  {
    id: "code",
    label: "Code",
    text: "def calculate_kv_cache(layers, heads, dim):",
    description: "Identifiers and syntax symbols split into separate tokens.",
  },
  {
    id: "non-english",
    label: "Non-English",
    text: "Bonjour le monde! 你好世界!",
    description: "Non-English and non-Latin scripts use more tokens per word.",
  },
]
