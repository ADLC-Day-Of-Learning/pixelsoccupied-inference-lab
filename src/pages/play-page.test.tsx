// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { PlayPage } from "./play-page"
import { LEVELS } from "@/play/levels"

describe("PlayPage end-to-end integration", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it("opens on level picker, opens Level 0 Tokens, completes challenges, and persists completion", () => {
    const { unmount } = render(<PlayPage />)

    // 1. Initial state: Level picker with Level 0 Tokens
    expect(screen.getByText("Inference Play")).toBeInTheDocument()
    expect(screen.getByText(/0 of \d+ complete/i)).toBeInTheDocument()

    const level0Card = screen.getByTestId("level-card-tokens")
    expect(level0Card).toHaveAttribute("data-level-state", "available")

    // 2. Open Level 0
    fireEvent.click(level0Card)
    expect(screen.getByText("Tokens")).toBeInTheDocument()
    expect(screen.getByText("Not yet")).toBeInTheDocument()

    // 3. Move to Challenge tab
    const challengeTab = screen.getByRole("tab", { name: /challenge/i })
    fireEvent.click(challengeTab)

    // 4. Complete Goal 1 and Goal 2
    const sentenceInput = screen.getByRole("textbox", {
      name: /your sentence/i,
    })
    const wordInput = screen.getByRole("textbox", {
      name: /your word/i,
    })

    fireEvent.change(sentenceInput, {
      target: { value: "The quick brown fox jumps over the lazy dog." },
    })
    fireEvent.change(wordInput, {
      target: { value: "antidisestablishmentarianism" },
    })

    // 5. Celebration and completion badge appear
    expect(screen.getByText(/Complete ✓/i)).toBeInTheDocument()
    expect(screen.getByTestId("completion-celebration")).toBeInTheDocument()

    // 6. Navigate back to levels
    const backButton = screen.getByRole("button", { name: /back to levels/i })
    fireEvent.click(backButton)

    // 7. Picker reflects completed status
    expect(screen.getByText(/1 of \d+ complete/i)).toBeInTheDocument()
    expect(screen.getByTestId("level-card-tokens")).toHaveAttribute(
      "data-level-state",
      "completed"
    )

    unmount()

    // 8. Simulate reload by remounting PlayPage: progress persists from localStorage
    render(<PlayPage />)
    expect(screen.getByText(/1 of \d+ complete/i)).toBeInTheDocument()
    expect(screen.getByTestId("level-card-tokens")).toHaveAttribute(
      "data-level-state",
      "completed"
    )

    // 9. Reset progress action
    const resetButton = screen.getByRole("button", { name: /reset progress/i })
    fireEvent.click(resetButton)
    const confirmButton = screen.getByRole("button", { name: /confirm reset/i })
    fireEvent.click(confirmButton)
    expect(screen.getByText(/0 of \d+ complete/i)).toBeInTheDocument()
    expect(screen.getByTestId("level-card-tokens")).toHaveAttribute(
      "data-level-state",
      "available"
    )
  })

  it("opens Level 4 (Batching) from picker and displays batching level", () => {
    window.localStorage.setItem(
      "inference-lab:play:progress",
      JSON.stringify({ completedLevelIds: ["prefill-decode"] })
    )

    render(<PlayPage />)

    const level4Card = screen.getByTestId("level-card-batching")
    expect(level4Card).toBeInTheDocument()
    expect(level4Card).toHaveAttribute("data-level-state", "available")

    fireEvent.click(level4Card)

    expect(
      screen.getByText("Batching (static vs continuous)")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Batching: Static vs Continuous")
    ).toBeInTheDocument()

    // Move to Try tab
    fireEvent.click(screen.getByRole("tab", { name: /try/i }))
    expect(
      screen.getByRole("radiogroup", { name: /batching strategy/i })
    ).toBeInTheDocument()
  })
})
