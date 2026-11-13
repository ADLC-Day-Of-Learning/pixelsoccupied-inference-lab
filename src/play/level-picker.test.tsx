// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { LevelPicker } from "./level-picker"
import type { LevelDefinition } from "./types"

const mockLevel0: LevelDefinition = {
  id: "how-it-works",
  number: 0,
  title: "How this works",
  concept: "Overview of micro-levels",
  Component: () => <div>Level 0 content</div>,
}

const mockLevel1: LevelDefinition = {
  id: "sampling",
  number: 1,
  title: "Sampling & Temperature",
  concept: "Greedy search vs top-p",
  Component: () => <div>Level 1 content</div>,
}

const mockLevel2: LevelDefinition = {
  id: "prefill-decode",
  number: 2,
  title: "Prefill vs. Decode",
  concept: "Compute vs memory bound",
  Component: () => <div>Level 2 content</div>,
}

const mockLevels: LevelDefinition[] = [mockLevel0, mockLevel1, mockLevel2]

describe("LevelPicker", () => {
  afterEach(() => {
    cleanup()
  })
  it("renders level cards with number, title, concept, and state", () => {
    const handleSelect = vi.fn()
    const handleReset = vi.fn()

    render(
      <LevelPicker
        levels={mockLevels}
        completedLevelIds={["how-it-works"]}
        onSelectLevel={handleSelect}
        onResetProgress={handleReset}
      />
    )

    // Check header and overall progress display
    expect(screen.getByText(/Inference Play/i)).toBeInTheDocument()
    expect(screen.getByText("1 of 3 complete")).toBeInTheDocument()

    // Check Level 0 card is completed
    const card0 = screen.getByTestId("level-card-how-it-works")
    expect(card0).toHaveAttribute("data-level-state", "completed")
    expect(card0).toHaveTextContent("How this works")
    expect(card0).toHaveTextContent("Completed ✓")

    // Check Level 1 card is available
    const card1 = screen.getByTestId("level-card-sampling")
    expect(card1).toHaveAttribute("data-level-state", "available")
    expect(card1).toHaveTextContent("Sampling & Temperature")
    expect(card1).toHaveTextContent("Available")

    // Check Level 2 card is locked (because Level 1 is not completed)
    const card2 = screen.getByTestId("level-card-prefill-decode")
    expect(card2).toHaveAttribute("data-level-state", "locked")
    expect(card2).toHaveTextContent("Prefill vs. Decode")
    expect(card2).toHaveTextContent("Locked")
  })

  it("allows opening available and completed levels, but prevents opening locked levels", () => {
    const handleSelect = vi.fn()
    const handleReset = vi.fn()

    render(
      <LevelPicker
        levels={mockLevels}
        completedLevelIds={["how-it-works"]}
        onSelectLevel={handleSelect}
        onResetProgress={handleReset}
      />
    )

    // Click available level -> triggers onSelectLevel
    const card1 = screen.getByTestId("level-card-sampling")
    fireEvent.click(card1)
    expect(handleSelect).toHaveBeenCalledWith("sampling")

    // Click completed level -> triggers onSelectLevel
    const card0 = screen.getByTestId("level-card-how-it-works")
    fireEvent.click(card0)
    expect(handleSelect).toHaveBeenCalledWith("how-it-works")

    // Click locked level -> does NOT trigger onSelectLevel
    handleSelect.mockClear()
    const card2 = screen.getByTestId("level-card-prefill-decode")
    expect(card2).toBeDisabled()
    expect(card2).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(card2)
    expect(handleSelect).not.toHaveBeenCalled()
  })

  it("provides a working Reset Progress action with confirmation dialog", () => {
    const handleSelect = vi.fn()
    const handleReset = vi.fn()

    render(
      <LevelPicker
        levels={mockLevels}
        completedLevelIds={["how-it-works"]}
        onSelectLevel={handleSelect}
        onResetProgress={handleReset}
      />
    )

    const resetButton = screen.getByRole("button", { name: /reset progress/i })
    expect(resetButton).toBeInTheDocument()
    fireEvent.click(resetButton)

    // Dialog appears with warning
    expect(screen.getByText("Reset progress?")).toBeInTheDocument()
    expect(
      screen.getByText(/permanently erase all completed level progress/i)
    ).toBeInTheDocument()

    // Confirming triggers reset
    const confirmButton = screen.getByRole("button", { name: /confirm reset/i })
    fireEvent.click(confirmButton)
    expect(handleReset).toHaveBeenCalledTimes(1)
  })

  it("does not show reset progress button when 0 levels are completed", () => {
    render(
      <LevelPicker
        levels={mockLevels}
        completedLevelIds={[]}
        onSelectLevel={vi.fn()}
        onResetProgress={vi.fn()}
      />
    )

    expect(screen.getByText("0 of 3 complete")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /reset progress/i })
    ).not.toBeInTheDocument()
  })
})
