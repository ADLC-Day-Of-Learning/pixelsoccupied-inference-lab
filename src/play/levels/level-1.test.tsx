// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { Level1Component } from "./level-1"
import { level1 } from "./index"
import { LevelLayout } from "../level-layout"

describe("Level1Component (Play Level 1: Sampling)", () => {
  afterEach(() => {
    cleanup()
  })

  function renderLevel1(onComplete = vi.fn(), isCompleted = false) {
    return render(
      <LevelLayout level={level1} isCompleted={isCompleted} onBack={vi.fn()}>
        <Level1Component onComplete={onComplete} />
      </LevelLayout>
    )
  }

  it("renders the Learn section by default with explanation and diagram", () => {
    renderLevel1()

    expect(
      screen.getByText(/How LLMs Pick Tokens: Logits, Softmax & Sampling/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/Raw Logits/i)).toBeInTheDocument()
    expect(screen.getByText(/Probabilities \(sum = 1\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Chosen Token/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /continue to try/i })
    ).toBeInTheDocument()
  })

  it("navigates to Try section and renders interactive controls with accessible labels", () => {
    renderLevel1()

    // Move to Try
    const tryTab = screen.getByRole("tab", { name: /try/i })
    fireEvent.click(tryTab)

    expect(screen.getByText(/Interactive Sampling Sandbox/i)).toBeInTheDocument()
    expect(
      screen.getByText(/The capital of France is…/i)
    ).toBeInTheDocument()

    // Accessible sliders
    const tempSlider = screen.getByRole("slider", { name: /temperature/i })
    const topKSlider = screen.getByRole("slider", { name: /top-k/i })
    const topPSlider = screen.getByRole("slider", { name: /top-p/i })

    expect(tempSlider).toBeInTheDocument()
    expect(topKSlider).toBeInTheDocument()
    expect(topPSlider).toBeInTheDocument()

    // Check candidate tokens are listed
    expect(screen.getByText(/"Paris"/i)).toBeInTheDocument()
    expect(screen.getByText(/"Lyon"/i)).toBeInTheDocument()
    expect(screen.getByText(/"Marseille"/i)).toBeInTheDocument()
    expect(screen.getByText(/"known"/i)).toBeInTheDocument()
  })

  it("greys out cut-off tokens when Top-K is reduced", () => {
    renderLevel1()

    const tryTab = screen.getByRole("tab", { name: /try/i })
    fireEvent.click(tryTab)

    const topKSlider = screen.getByRole("slider", { name: /top-k/i })

    // Set Top-K to 4
    fireEvent.change(topKSlider, { target: { value: "4" } })

    // Elements for tail tokens should be marked as cut off
    const cutOffBadges = screen.getAllByText(/cut off/i)
    expect(cutOffBadges.length).toBe(4)

    // Reset defaults button restores top-k to 8
    const resetButton = screen.getByRole("button", { name: /reset defaults/i })
    fireEvent.click(resetButton)
    expect(screen.queryByText(/cut off/i)).not.toBeInTheDocument()
  })

  it("generates 20 sample chips and distribution counts when Sample 20x is clicked", () => {
    renderLevel1()

    const tryTab = screen.getByRole("tab", { name: /try/i })
    fireEvent.click(tryTab)

    const sampleButton = screen.getByRole("button", { name: /sample 20×/i })
    fireEvent.click(sampleButton)

    // Sequence container and distribution counts
    expect(screen.getByText(/Sampled sequence \(20 tokens\):/i)).toBeInTheDocument()
    expect(screen.getByText(/Distribution counts:/i)).toBeInTheDocument()
  })

  it("evaluates Challenge Goal 1 when greedy decoding is applied and calls onComplete when both goals pass", () => {
    const handleComplete = vi.fn()
    renderLevel1(handleComplete)

    // Navigate to Challenge
    const challengeTab = screen.getByRole("tab", { name: /challenge/i })
    fireEvent.click(challengeTab)

    expect(screen.getByText(/Goal 1: Deterministic Output/i)).toBeInTheDocument()
    expect(screen.getByText(/Goal 2: Safe Diversity/i)).toBeInTheDocument()

    // Navigate back to Try to configure Goal 1 (Top-K = 1 for 100% Paris)
    const tryTab = screen.getByRole("tab", { name: /try/i })
    fireEvent.click(tryTab)

    const topKSlider = screen.getByRole("slider", { name: /top-k/i })
    fireEvent.change(topKSlider, { target: { value: "1" } })

    // Return to Challenge and sample
    fireEvent.click(challengeTab)
    const sampleAndTestButton = screen.getByRole("button", {
      name: /sample 20× & test goals/i,
    })
    fireEvent.click(sampleAndTestButton)

    // Goal 1 is passed
    expect(screen.getByText(/✓ Goal met! Paris answered 20\/20 times/i)).toBeInTheDocument()
    // Goal 2 is not yet met
    expect(handleComplete).not.toHaveBeenCalled()

    // Now configure Goal 2: T = 1.4, Top-K = 4
    fireEvent.click(tryTab)
    const newTempSlider = screen.getByRole("slider", { name: /temperature/i })
    const newTopKSlider = screen.getByRole("slider", { name: /top-k/i })
    fireEvent.change(newTempSlider, { target: { value: "1.4" } })
    fireEvent.change(newTopKSlider, { target: { value: "4" } })

    // Return to Challenge and sample until Goal 2 passes (high probability per click)
    fireEvent.click(challengeTab)
    const currentSampleButton = screen.getByRole("button", {
      name: /sample 20× & test goals/i,
    })
    for (let attempt = 0; attempt < 10; attempt++) {
      fireEvent.click(currentSampleButton)
      if (handleComplete.mock.calls.length > 0) break
    }

    expect(handleComplete).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Level 1 Mastered!/i)).toBeInTheDocument()

    // WCAG 4.1.3: completion announcement live region
    const statusRegions = screen.getAllByRole("status")
    const masteredRegion = statusRegions.find((el) =>
      el.textContent?.includes("Level 1 Mastered!")
    )
    expect(masteredRegion).toBeDefined()
    expect(masteredRegion).toHaveAttribute("aria-live", "polite")
    expect(masteredRegion).toHaveAttribute("aria-atomic", "true")
  })

  it("displays initial instructional state in Challenge section before sampling", () => {
    renderLevel1()

    const challengeTab = screen.getByRole("tab", { name: /challenge/i })
    fireEvent.click(challengeTab)

    expect(
      screen.getByText(
        /Click "Sample 20× & Test Goals" to test your current temperature/i
      )
    ).toBeInTheDocument()
  })

  it("displays completed status and passed goals when revisited as already completed", () => {
    renderLevel1(vi.fn(), true)

    const challengeTab = screen.getByRole("tab", { name: /challenge/i })
    fireEvent.click(challengeTab)

    expect(screen.getByText(/Completed ✓/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Passed ✓/i).length).toBe(2)

    const statusRegions = screen.getAllByRole("status")
    const masteredRegion = statusRegions.find((el) =>
      el.textContent?.includes("Level 1 Mastered!")
    )
    expect(masteredRegion).toBeDefined()
    expect(masteredRegion).toHaveTextContent(/Level 1 Mastered!/i)
  })

  it("displays 1 active / 8 total and marks tail tokens cut off in greedy mode (temperature = 0)", () => {
    renderLevel1()

    const tryTab = screen.getByRole("tab", { name: /try/i })
    fireEvent.click(tryTab)

    const tempSlider = screen.getByRole("slider", { name: /temperature/i })
    fireEvent.change(tempSlider, { target: { value: "0" } })

    expect(screen.getByText(/1 active \/ 8 total/i)).toBeInTheDocument()
    const cutOffBadges = screen.getAllByText(/cut off/i)
    expect(cutOffBadges.length).toBe(7)
  })

  it("renders the Recap section with key takeaways", () => {
    renderLevel1()

    const recapTab = screen.getByRole("tab", { name: /recap/i })
    fireEvent.click(recapTab)

    expect(
      screen.getByText(/Temperature → 0 is greedy decoding/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Top-P \(nucleus sampling\) covers probability mass/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Creativity vs. reliability is a sampling choice/i)
    ).toBeInTheDocument()
  })
})
