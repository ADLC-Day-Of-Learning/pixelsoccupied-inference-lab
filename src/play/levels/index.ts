import type { LevelDefinition } from "../types"
import { Level3Component } from "./level-3"
import { Level4Component } from "./level-4"
import { TokensLevelComponent } from "./tokens"

export { Level3Component } from "./level-3"
export { Level4Component } from "./level-4"
export { TokensLevelComponent } from "./tokens"

export const level0: LevelDefinition = {
  id: "tokens",
  number: 0,
  title: "Tokens",
  concept: "What the model actually reads: chunks of text mapped to integer IDs.",
  Component: TokensLevelComponent,
}

export const level3: LevelDefinition = {
  id: "kv-cache",
  number: 3,
  title: "KV Cache Memory",
  concept: "Every token in flight keeps keys and values in GPU memory, limiting concurrency and context.",
  Component: Level3Component,
}

export const level4: LevelDefinition = {
  id: "batching",
  number: 4,
  title: "Batching (static vs continuous)",
  concept:
    "See how continuous batching eliminates idle slots and balances throughput against latency.",
  Component: Level4Component,
}

/**
 * Registry of all available Play levels, sorted in ascending order by level number.
 * Real levels 1-5 will append to or replace entries in this registry.
 */
export const LEVELS: LevelDefinition[] = [level0, level3, level4].sort(
  (a, b) => a.number - b.number
)
