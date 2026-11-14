import type { LevelDefinition } from "../types"
import { Level2Component } from "./level-2"
import { TokensLevelComponent } from "./tokens"

export { Level2Component } from "./level-2"
export { TokensLevelComponent } from "./tokens"

export const level0: LevelDefinition = {
  id: "tokens",
  number: 0,
  title: "Tokens",
  concept: "What the model actually reads: chunks of text mapped to integer IDs.",
  Component: TokensLevelComponent,
}

export const level2: LevelDefinition = {
  id: "prefill-decode",
  number: 2,
  title: "Prefill vs. Decode",
  concept: "Prefill sets TTFT (compute-bound); decode sets inter-token latency (bandwidth-bound).",
  Component: Level2Component,
}

/**
 * Registry of all available Play levels, sorted in ascending order by level number.
 * Real levels 1-5 will append to or replace entries in this registry.
 */
export const LEVELS: LevelDefinition[] = [level0, level2].sort(
  (a, b) => a.number - b.number
)
