// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { LevelLayout, LevelSectionContent } from "./level-layout"
import type { LevelDefinition } from "./types"

const mockLevel: LevelDefinition = {
  id: "how-it-works",
  number: 0,
  title: "How this works",
  concept: "Introductory concept",
  Component: () => null,
}

describe("LevelLayout", () => {
  afterEach(() => {
    cleanup()
  })
  it("renders the 4 labeled sections and allows moving freely between them", () => {
    const handleBack = vi.fn()

    render(
      <LevelLayout level={mockLevel} isCompleted={false} onBack={handleBack}>
        <LevelSectionContent section="learn">
          <div>Learn Section Content</div>
        </LevelSectionContent>
        <LevelSectionContent section="try">
          <div>Try Section Content</div>
        </LevelSectionContent>
        <LevelSectionContent section="challenge">
          <div>Challenge Section Content</div>
        </LevelSectionContent>
        <LevelSectionContent section="recap">
          <div>Recap Section Content</div>
        </LevelSectionContent>
      </LevelLayout>
    )

    // Initial section is Learn
    expect(screen.getByText("Learn Section Content")).toBeInTheDocument()
    expect(screen.queryByText("Try Section Content")).not.toBeInTheDocument()
    const learnPanel = screen.getByRole("tabpanel")
    expect(learnPanel).toHaveAttribute("id", "section-panel-learn")
    expect(learnPanel).toHaveAttribute("aria-labelledby", "section-tab-learn")

    // Switch to Try
    const tryTab = screen.getByRole("tab", { name: /try/i })
    fireEvent.click(tryTab)
    expect(screen.getByText("Try Section Content")).toBeInTheDocument()
    expect(screen.queryByText("Learn Section Content")).not.toBeInTheDocument()

    // Switch to Challenge
    const challengeTab = screen.getByRole("tab", { name: /challenge/i })
    fireEvent.click(challengeTab)
    expect(screen.getByText("Challenge Section Content")).toBeInTheDocument()

    // Switch to Recap
    const recapTab = screen.getByRole("tab", { name: /recap/i })
    fireEvent.click(recapTab)
    expect(screen.getByText("Recap Section Content")).toBeInTheDocument()

    // Move freely back to Learn
    const learnTab = screen.getByRole("tab", { name: /learn/i })
    fireEvent.click(learnTab)
    expect(screen.getByText("Learn Section Content")).toBeInTheDocument()
  })

  it("displays 'Not yet' badge when incomplete and 'Complete ✓' badge when completed", () => {
    const { rerender } = render(
      <LevelLayout level={mockLevel} isCompleted={false} onBack={vi.fn()}>
        <div>Content</div>
      </LevelLayout>
    )

    expect(screen.getByText("Not yet")).toBeInTheDocument()
    expect(screen.queryByText(/Complete ✓/i)).not.toBeInTheDocument()

    rerender(
      <LevelLayout level={mockLevel} isCompleted={true} onBack={vi.fn()}>
        <div>Content</div>
      </LevelLayout>
    )

    expect(screen.getByText(/Complete ✓/i)).toBeInTheDocument()
    const celebration = screen.getByTestId("completion-celebration")
    expect(celebration).toBeInTheDocument()
    expect(celebration).toHaveAttribute("role", "status")
    expect(celebration).toHaveAttribute("aria-live", "polite")
  })

  it("handles Back to levels and Next level button clicks", () => {
    const handleBack = vi.fn()
    const handleNext = vi.fn()

    render(
      <LevelLayout
        level={mockLevel}
        isCompleted={true}
        onBack={handleBack}
        onNext={handleNext}
      >
        <div>Content</div>
      </LevelLayout>
    )

    const backButton = screen.getByRole("button", { name: /back to levels/i })
    fireEvent.click(backButton)
    expect(handleBack).toHaveBeenCalledTimes(1)

    const nextButtons = screen.getAllByRole("button", { name: /next level/i })
    fireEvent.click(nextButtons[0])
    expect(handleNext).toHaveBeenCalled()
  })
})
