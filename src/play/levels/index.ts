import type { LevelDefinition } from "../types"
import { Level1Component } from "./level-1"
import { Level2Component } from "./level-2"
import { Level4Component } from "./level-4"
import { Level5Component } from "./level-5"
import { TokensLevelComponent } from "./tokens"

export { Level1Component } from "./level-1"
export { Level2Component } from "./level-2"
export { Level4Component } from "./level-4"
export { Level5Component } from "./level-5"
export { TokensLevelComponent } from "./tokens"

export const level0: LevelDefinition = {
  id: "tokens",
  number: 0,
  title: "Tokens",
  concept: "What the model actually reads: chunks of text mapped to integer IDs.",
  Component: TokensLevelComponent,
}

export const level1: LevelDefinition = {
  id: "sampling",
  number: 1,
  title: "Sampling",
  concept:
    "An LLM picks each next token by sampling from a probability distribution. Temperature reshapes it, and top-k / top-p cut off the tail.",
  Component: Level1Component,
}

export const level2: LevelDefinition = {
  id: "prefill-decode",
  number: 2,
  title: "Prefill vs. Decode",
  concept: "Prefill sets TTFT (compute-bound); decode sets inter-token latency (bandwidth-bound).",
  Component: Level2Component,
}

export const level4: LevelDefinition = {
  id: "batching",
  number: 4,
  title: "Batching (static vs continuous)",
  concept:
    "See how continuous batching eliminates idle slots and balances throughput against latency.",
  Component: Level4Component,
}

export const level5: LevelDefinition = {
  id: "quantization-and-model-choice",
  number: 5,
  title: "Quantization and model choice",
  concept:
    "Smaller models and lower precision are faster and cheaper and leave more room for KV cache, but cost quality.",
  Component: Level5Component,
}

/**
 * Registry of all available Play levels, sorted in ascending order by level number.
 * Real levels 1-5 will append to or replace entries in this registry.
 */
export const LEVELS: LevelDefinition[] = [
  level0,
  level1,
  level2,
  level4,
  level5,
].sort((a, b) => a.number - b.number)
