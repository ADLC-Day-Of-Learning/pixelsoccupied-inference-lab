import * as React from "react"
import type { LevelDefinition } from "./types"

export const PROGRESS_STORAGE_KEY = "inference-lab:play:progress"

export interface ProgressState {
  completedLevelIds: string[]
}

export type LevelState = "completed" | "available" | "locked"

/**
 * Returns a fresh, empty progress state.
 */
export function getInitialProgressState(): ProgressState {
  return {
    completedLevelIds: [],
  }
}

/**
 * Loads progress from localStorage with graceful fallback to empty state.
 */
export function loadProgress(): ProgressState {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return getInitialProgressState()
    }
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY)
    if (!raw) {
      return getInitialProgressState()
    }
    const parsed = JSON.parse(raw) as Partial<ProgressState>
    if (parsed && Array.isArray(parsed.completedLevelIds)) {
      return {
        completedLevelIds: parsed.completedLevelIds.filter(
          (id): id is string => typeof id === "string"
        ),
      }
    }
  } catch {
    // Storage access or JSON parse failed; fall back to in-memory initial state.
  }
  return getInitialProgressState()
}

/**
 * Saves progress state to localStorage wrapped in try/catch.
 */
export function saveProgress(state: ProgressState): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(state))
    }
  } catch {
    // Storage quota exceeded or disabled (e.g. private browsing mode).
  }
}

/**
 * Pure function returning new state with level marked as completed.
 */
export function markLevelCompleted(
  state: ProgressState,
  levelIdOrNumber: string | number,
  levels: LevelDefinition[] = []
): ProgressState {
  let resolvedId: string
  if (typeof levelIdOrNumber === "number") {
    const matched = levels.find((l) => l.number === levelIdOrNumber)
    resolvedId = matched ? matched.id : `level-${levelIdOrNumber}`
  } else {
    resolvedId = levelIdOrNumber
  }

  if (state.completedLevelIds.includes(resolvedId)) {
    return state
  }

  return {
    ...state,
    completedLevelIds: [...state.completedLevelIds, resolvedId],
  }
}

/**
 * Clears all progress.
 */
export function resetProgress(_state?: ProgressState): ProgressState {
  return getInitialProgressState()
}

/**
 * Checks whether a level is completed.
 */
export function isLevelCompleted(
  state: ProgressState,
  levelIdOrNumber: string | number,
  levels: LevelDefinition[] = []
): boolean {
  if (typeof levelIdOrNumber === "number") {
    const matched = levels.find((l) => l.number === levelIdOrNumber)
    if (matched && state.completedLevelIds.includes(matched.id)) {
      return true
    }
    return (
      state.completedLevelIds.includes(`level-${levelIdOrNumber}`) ||
      state.completedLevelIds.includes(String(levelIdOrNumber))
    )
  }
  return state.completedLevelIds.includes(levelIdOrNumber)
}

/**
 * Evaluates whether a level is unlocked:
 * - Levels 0 and 1 are always unlocked.
 * - Completed levels are always accessible.
 * - Level N+1 unlocks when Level N is completed.
 */
export function isLevelUnlocked(
  state: ProgressState,
  levelOrNumber: LevelDefinition | string | number,
  levels: LevelDefinition[] = []
): boolean {
  let levelNum: number | undefined
  let levelId: string | undefined

  if (typeof levelOrNumber === "object" && levelOrNumber !== null) {
    levelNum = levelOrNumber.number
    levelId = levelOrNumber.id
  } else if (typeof levelOrNumber === "number") {
    levelNum = levelOrNumber
    const matched = levels.find((l) => l.number === levelOrNumber)
    levelId = matched?.id
  } else {
    levelId = levelOrNumber
    const matched = levels.find((l) => l.id === levelOrNumber)
    levelNum = matched?.number
  }

  if (levelNum === undefined && levelId !== undefined) {
    const match = levelId.match(/(\d+)/)
    if (match) {
      levelNum = parseInt(match[1], 10)
    }
  }

  // Level 0 and Level 1 are always unlocked initially
  if (levelNum !== undefined && levelNum <= 1) {
    return true
  }

  // If already completed, it can be re-opened
  if (levelId && isLevelCompleted(state, levelId, levels)) {
    return true
  }

  // Level N unlocks when level N - 1 is completed
  if (levelNum !== undefined && levelNum > 1) {
    const prevNum = levelNum - 1
    const prevLevel = levels.find((l) => l.number === prevNum)
    if (prevLevel) {
      return isLevelCompleted(state, prevLevel.id, levels)
    }
    return (
      state.completedLevelIds.includes(`level-${prevNum}`) ||
      state.completedLevelIds.includes(String(prevNum))
    )
  }

  return false
}

/**
 * Returns "completed" | "available" | "locked" for a given level definition.
 */
export function getLevelState(
  state: ProgressState,
  level: LevelDefinition,
  levels: LevelDefinition[] = []
): LevelState {
  if (isLevelCompleted(state, level.id, levels)) {
    return "completed"
  }
  if (isLevelUnlocked(state, level, levels)) {
    return "available"
  }
  return "locked"
}

/**
 * React hook to access and manage Play progress.
 */
export function useProgress(levels: LevelDefinition[] = []) {
  const [state, setState] = React.useState<ProgressState>(() => loadProgress())

  const completeLevel = React.useCallback(
    (levelIdOrNumber: string | number) => {
      setState((prev) => {
        const next = markLevelCompleted(prev, levelIdOrNumber, levels)
        saveProgress(next)
        return next
      })
    },
    [levels]
  )

  const reset = React.useCallback(() => {
    const next = resetProgress()
    saveProgress(next)
    setState(next)
  }, [])

  return {
    completedLevelIds: state.completedLevelIds,
    isCompleted: React.useCallback(
      (levelIdOrNumber: string | number) =>
        isLevelCompleted(state, levelIdOrNumber, levels),
      [state, levels]
    ),
    isUnlocked: React.useCallback(
      (level: LevelDefinition | string | number) =>
        isLevelUnlocked(state, level, levels),
      [state, levels]
    ),
    getLevelState: React.useCallback(
      (level: LevelDefinition) => getLevelState(state, level, levels),
      [state, levels]
    ),
    completeLevel,
    resetProgress: reset,
  }
}
