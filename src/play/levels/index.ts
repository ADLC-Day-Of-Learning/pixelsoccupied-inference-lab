import type { LevelDefinition } from "../types"
import { Level0Component } from "./level-0"

export { Level0Component } from "./level-0"

export const level0: LevelDefinition = {
  id: "how-it-works",
  number: 0,
  title: "How this works",
  concept: "Learn how interactive levels, try sandboxes, and challenges work.",
  Component: Level0Component,
}

/**
 * Registry of all available Play levels, sorted in ascending order by level number.
 * Real levels 1-5 will append to or replace entries in this registry.
 */
export const LEVELS: LevelDefinition[] = [level0].sort(
  (a, b) => a.number - b.number
)
