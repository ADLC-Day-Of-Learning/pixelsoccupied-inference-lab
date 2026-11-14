import type { LevelDefinition } from "../types"
import { TokensLevelComponent } from "./tokens"
import { Level5Component } from "./level-5"

export { TokensLevelComponent } from "./tokens"
export { Level5Component } from "./level-5"

export const level0: LevelDefinition = {
  id: "tokens",
  number: 0,
  title: "Tokens",
  concept: "What the model actually reads: chunks of text mapped to integer IDs.",
  Component: TokensLevelComponent,
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
export const LEVELS: LevelDefinition[] = [level0, level5].sort(
  (a, b) => a.number - b.number
)
