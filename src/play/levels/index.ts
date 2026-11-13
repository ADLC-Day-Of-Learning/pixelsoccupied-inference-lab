import type { LevelDefinition } from "../types"
import { Level0Component } from "./level-0"
import { Level2Component } from "./level-2"

export { Level0Component } from "./level-0"
export { Level2Component } from "./level-2"

export const level0: LevelDefinition = {
  id: "how-it-works",
  number: 0,
  title: "How this works",
  concept: "Learn how interactive levels, try sandboxes, and challenges work.",
  Component: Level0Component,
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
