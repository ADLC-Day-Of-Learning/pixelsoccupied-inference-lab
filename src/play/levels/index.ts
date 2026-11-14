import type { LevelDefinition } from "../types"
import { TokensLevelComponent } from "./tokens"

export { TokensLevelComponent } from "./tokens"

export const level0: LevelDefinition = {
  id: "tokens",
  number: 0,
  title: "Tokens",
  concept: "What the model actually reads: chunks of text mapped to integer IDs.",
  Component: TokensLevelComponent,
}

/**
 * Registry of all available Play levels, sorted in ascending order by level number.
 * Real levels 1-5 will append to or replace entries in this registry.
 */
export const LEVELS: LevelDefinition[] = [level0].sort(
  (a, b) => a.number - b.number
)
