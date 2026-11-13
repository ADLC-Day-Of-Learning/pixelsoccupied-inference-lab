import type { LevelDefinition } from "../types"
import { Level0Component } from "./level-0"
import { Level3Component } from "./level-3"

export { Level0Component } from "./level-0"
export { Level3Component } from "./level-3"

export const level0: LevelDefinition = {
  id: "how-it-works",
  number: 0,
  title: "How this works",
  concept: "Learn how interactive levels, try sandboxes, and challenges work.",
  Component: Level0Component,
}

export const level3: LevelDefinition = {
  id: "kv-cache",
  number: 3,
  title: "KV Cache Memory",
  concept: "Every token in flight keeps keys and values in GPU memory, limiting concurrency and context.",
  Component: Level3Component,
}

/**
 * Registry of all available Play levels, sorted in ascending order by level number.
 * Real levels 1-5 will append to or replace entries in this registry.
 */
export const LEVELS: LevelDefinition[] = [level0, level3].sort(
  (a, b) => a.number - b.number
)
