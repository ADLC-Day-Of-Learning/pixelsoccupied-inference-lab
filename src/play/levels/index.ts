import type { LevelDefinition } from "../types"
import { TokensLevelComponent } from "./tokens"
import { Level1Component } from "./level-1"

export { TokensLevelComponent } from "./tokens"
export { Level1Component } from "./level-1"

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

/**
 * Registry of all available Play levels, sorted in ascending order by level number.
 * Real levels 1-5 will append to or replace entries in this registry.
 */
export const LEVELS: LevelDefinition[] = [level0, level1].sort(
  (a, b) => a.number - b.number
)
