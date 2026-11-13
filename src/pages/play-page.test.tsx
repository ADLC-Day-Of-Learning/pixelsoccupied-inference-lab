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

  it("opens on level picker, opens placeholder level, completes it, and persists completion", () => {
    const { unmount } = render(<PlayPage />)

    // 1. Initial state: Level picker with placeholder level
    expect(screen.getByText("Inference Play")).toBeInTheDocument()
    expect(screen.getByText(`0 of ${LEVELS.length} complete`)).toBeInTheDocument()

    const level0Card = screen.getByTestId("level-card-how-it-works")
    expect(level0Card).toHaveAttribute("data-level-state", "available")

    // 2. Open Level 0
    fireEvent.click(level0Card)
    expect(screen.getByText("How this works")).toBeInTheDocument()
    expect(screen.getByText("Not yet")).toBeInTheDocument()

    // 3. Move to Challenge tab
    const challengeTab = screen.getByRole("tab", { name: /challenge/i })
    fireEvent.click(challengeTab)

    // 4. Click complete challenge button
    const completeButton = screen.getByRole("button", {
      name: /complete level 0 challenge/i,
    })
    fireEvent.click(completeButton)

    // 5. Celebration and completion badge appear
    expect(screen.getByText(/Complete ✓/i)).toBeInTheDocument()
    expect(screen.getByTestId("completion-celebration")).toBeInTheDocument()

    // 6. Navigate back to levels
    const backButton = screen.getByRole("button", { name: /back to levels/i })
    fireEvent.click(backButton)

    // 7. Picker reflects completed status
    expect(screen.getByText(`1 of ${LEVELS.length} complete`)).toBeInTheDocument()
    expect(screen.getByTestId("level-card-how-it-works")).toHaveAttribute(
      "data-level-state",
      "completed"
    )

    unmount()

    // 8. Simulate reload by remounting PlayPage: progress persists from localStorage
    render(<PlayPage />)
    expect(screen.getByText(`1 of ${LEVELS.length} complete`)).toBeInTheDocument()
    expect(screen.getByTestId("level-card-how-it-works")).toHaveAttribute(
      "data-level-state",
      "completed"
    )

    // 9. Reset progress action
    const resetButton = screen.getByRole("button", { name: /reset progress/i })
    fireEvent.click(resetButton)
    const confirmButton = screen.getByRole("button", { name: /confirm reset/i })
    fireEvent.click(confirmButton)
    expect(screen.getByText(`0 of ${LEVELS.length} complete`)).toBeInTheDocument()
    expect(screen.getByTestId("level-card-how-it-works")).toHaveAttribute(
      "data-level-state",
      "available"
    )
  })
})
