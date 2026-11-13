import type { LevelDefinition } from "../types"
import { Level0Component } from "./level-0"
import { Level4Component } from "./level-4"

export { Level0Component } from "./level-0"
export { Level4Component } from "./level-4"

export const level0: LevelDefinition = {
  id: "how-it-works",
  number: 0,
  title: "How this works",
  concept: "Learn how interactive levels, try sandboxes, and challenges work.",
  Component: Level0Component,
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
export const LEVELS: LevelDefinition[] = [level0, level4].sort(
  (a, b) => a.number - b.number
)
