// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  getInitialProgressState,
  markLevelCompleted,
  resetProgress,
  isLevelUnlocked,
  isLevelCompleted,
  getLevelState,
  loadProgress,
  saveProgress,
  PROGRESS_STORAGE_KEY,
} from "./progress"
import type { LevelDefinition } from "./types"

const mockLevel0: LevelDefinition = {
  id: "how-it-works",
  number: 0,
  title: "How this works",
  concept: "Intro",
  Component: () => null,
}

const mockLevel1: LevelDefinition = {
  id: "sampling",
  number: 1,
  title: "Sampling",
  concept: "Sampling concept",
  Component: () => null,
}

const mockLevel2: LevelDefinition = {
  id: "prefill-decode",
  number: 2,
  title: "Prefill vs Decode",
  concept: "Prefill concept",
  Component: () => null,
}

const mockLevel3: LevelDefinition = {
  id: "kv-cache",
  number: 3,
  title: "KV Cache",
  concept: "KV concept",
  Component: () => null,
}

const mockLevels: LevelDefinition[] = [mockLevel0, mockLevel1, mockLevel2, mockLevel3]

describe("progress and level unlocking", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("leaves Level 1 (and Level 0) available initially while subsequent levels remain locked", () => {
    const state = getInitialProgressState()
    expect(isLevelUnlocked(state, 0, mockLevels)).toBe(true)
    expect(isLevelUnlocked(state, 1, mockLevels)).toBe(true)
    expect(isLevelUnlocked(state, 2, mockLevels)).toBe(false)
    expect(isLevelUnlocked(state, 3, mockLevels)).toBe(false)

    // Also supports passing LevelDefinition object
    expect(isLevelUnlocked(state, mockLevel0, mockLevels)).toBe(true)
    expect(isLevelUnlocked(state, mockLevel1, mockLevels)).toBe(true)
    expect(isLevelUnlocked(state, mockLevel2, mockLevels)).toBe(false)
  })

  it("unlocks Level N+1 upon completion of Level N", () => {
    const initialState = getInitialProgressState()
    expect(isLevelUnlocked(initialState, 2, mockLevels)).toBe(false)

    // Complete Level 1
    const updated = markLevelCompleted(initialState, mockLevel1.id, mockLevels)
    expect(isLevelCompleted(updated, mockLevel1.id, mockLevels)).toBe(true)
    expect(isLevelCompleted(updated, mockLevel1, mockLevels)).toBe(true)
    expect(isLevelUnlocked(updated, 2, mockLevels)).toBe(true)
    expect(isLevelUnlocked(updated, 3, mockLevels)).toBe(false)

    // Complete Level 2 using LevelDefinition object
    const updated2 = markLevelCompleted(updated, mockLevel2, mockLevels)
    expect(isLevelCompleted(updated2, mockLevel2, mockLevels)).toBe(true)
    expect(isLevelUnlocked(updated2, 3, mockLevels)).toBe(true)
  })

  it("supports marking completed and checking unlock with numeric level indicators", () => {
    const initialState = getInitialProgressState()
    const updated = markLevelCompleted(initialState, 1, mockLevels)
    expect(isLevelUnlocked(updated, 2, mockLevels)).toBe(true)
  })

  it("unlocks non-consecutive levels when the preceding registered level in the registry is completed", () => {
    const mockLevel5: LevelDefinition = {
      id: "quantization-and-model-choice",
      number: 5,
      title: "Quantization and model choice",
      concept: "Quantization concept",
      Component: () => null,
    }
    const levelsWithGaps = [mockLevel0, mockLevel5]

    const initialState = getInitialProgressState()
    expect(isLevelUnlocked(initialState, mockLevel5, levelsWithGaps)).toBe(false)

    // Complete Level 0 (the preceding registered level in registry)
    const completed = markLevelCompleted(
      initialState,
      mockLevel0.id,
      levelsWithGaps
    )
    expect(isLevelUnlocked(completed, mockLevel5, levelsWithGaps)).toBe(true)
  })

  it("does not duplicate completed level IDs when marked multiple times", () => {
    const initialState = getInitialProgressState()
    const once = markLevelCompleted(initialState, "how-it-works", mockLevels)
    const twice = markLevelCompleted(once, "how-it-works", mockLevels)
    expect(twice.completedLevelIds).toEqual(["how-it-works"])
  })

  it("clears all completions when resetting progress", () => {
    let state = getInitialProgressState()
    state = markLevelCompleted(state, "how-it-works", mockLevels)
    state = markLevelCompleted(state, "sampling", mockLevels)
    expect(state.completedLevelIds.length).toBe(2)

    const reset = resetProgress()
    expect(reset.completedLevelIds).toEqual([])
  })

  it("correctly identifies level state as locked, available, or completed", () => {
    let state = getInitialProgressState()
    expect(getLevelState(state, mockLevel0, mockLevels)).toBe("available")
    expect(getLevelState(state, mockLevel1, mockLevels)).toBe("available")
    expect(getLevelState(state, mockLevel2, mockLevels)).toBe("locked")

    state = markLevelCompleted(state, mockLevel0.id, mockLevels)
    expect(getLevelState(state, mockLevel0, mockLevels)).toBe("completed")
    expect(getLevelState(state, mockLevel1, mockLevels)).toBe("available")
    expect(getLevelState(state, mockLevel2, mockLevels)).toBe("locked")

    state = markLevelCompleted(state, mockLevel1.id, mockLevels)
    expect(getLevelState(state, mockLevel1, mockLevels)).toBe("completed")
    expect(getLevelState(state, mockLevel2, mockLevels)).toBe("available")
  })

  it("handles storage access errors gracefully when localStorage is unavailable", () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: Access is denied")
    })
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })

    // Does not throw when reading
    expect(() => loadProgress()).not.toThrow()
    expect(loadProgress()).toEqual({ completedLevelIds: [] })

    // Does not throw when writing
    expect(() => saveProgress({ completedLevelIds: ["test"] })).not.toThrow()

    getItemSpy.mockRestore()
    setItemSpy.mockRestore()
  })

  it("persists and reloads progress from localStorage cleanly", () => {
    const state = { completedLevelIds: ["how-it-works", "sampling"] }
    saveProgress(state)

    const stored = window.localStorage.getItem(PROGRESS_STORAGE_KEY)
    expect(stored).toContain("how-it-works")

    const loaded = loadProgress()
    expect(loaded).toEqual(state)
  })

  it("falls back to empty state on malformed stored JSON", () => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, "invalid json {")
    const loaded = loadProgress()
    expect(loaded).toEqual({ completedLevelIds: [] })
  })
})
