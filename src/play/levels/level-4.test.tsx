// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { Level4Component } from "./level-4"
import { LevelLayout } from "../level-layout"
import { level4 } from "./index"

describe("Level4Component", () => {
  afterEach(() => {
    cleanup()
  })

  function renderLevel4(onComplete = vi.fn()) {
    return render(
      <LevelLayout level={level4} isCompleted={false} onBack={vi.fn()}>
        <Level4Component onComplete={onComplete} />
      </LevelLayout>
    )
  }

  it("renders Learn section initially with diagram and concept explanation", () => {
    renderLevel4()

    expect(
      screen.getByText("Batching: Static vs Continuous")
    ).toBeInTheDocument()

    // Assert SVG execution timeline diagram is present
    expect(
      screen.getByRole("img", {
        name: /diagram showing static batching with idle bubbles/i,
      })
    ).toBeInTheDocument()

    // Button to continue to Try section
    expect(
      screen.getByRole("button", { name: /continue to try/i })
    ).toBeInTheDocument()
  })

  it("navigates to Try section and renders compound controls with accessible names", () => {
    renderLevel4()

    // Navigate to Try section
    fireEvent.click(screen.getByRole("tab", { name: /try/i }))

    expect(screen.getByText("Batching Sandbox")).toBeInTheDocument()

    // Assert compound control (ToggleGroup) using role-based accessible query per AGENTS.md
    const strategyGroup = screen.getByRole("radiogroup", {
      name: /batching strategy/i,
    })
    expect(strategyGroup).toBeInTheDocument()

    // Verify Static and Continuous options exist without redundant aria-labels
    const staticOption = screen.getByRole("radio", { name: /^static$/i })
    const continuousOption = screen.getByRole("radio", { name: /^continuous$/i })
    expect(staticOption).toBeInTheDocument()
    expect(continuousOption).toBeInTheDocument()

    // Sliders for batch size and arrival rate
    expect(
      screen.getByRole("slider", { name: /max batch size/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("slider", { name: /request arrival rate/i })
    ).toBeInTheDocument()

    // Metrics cards
    expect(screen.getByText(/^Throughput$/i)).toBeInTheDocument()
    expect(screen.getByText(/^p95 Latency$/i)).toBeInTheDocument()
    expect(screen.getByText(/^GPU Slot Utilization$/i)).toBeInTheDocument()
    expect(screen.getByText(/^Decode Step Time$/i)).toBeInTheDocument()

    // SVG Chart with SLO line
    expect(
      screen.getByRole("img", {
        name: /chart showing throughput rising with batch size/i,
      })
    ).toBeInTheDocument()
    expect(screen.getByText(/Latency SLO \(2\.0 s\)/i)).toBeInTheDocument()
  })

  it("allows switching between Static and Continuous batching and toggling formula explanation", () => {
    renderLevel4()

    // Go to Try section
    fireEvent.click(screen.getByRole("tab", { name: /try/i }))

    const staticOption = screen.getByRole("radio", { name: /^static$/i })
    const continuousOption = screen.getByRole("radio", { name: /^continuous$/i })

    // Initially continuous
    expect(continuousOption).toHaveAttribute("data-state", "on")

    // Switch to static
    fireEvent.click(staticOption)
    expect(staticOption).toHaveAttribute("data-state", "on")

    // Switch back to continuous
    fireEvent.click(continuousOption)
    expect(continuousOption).toHaveAttribute("data-state", "on")

    // Toggle formula collapsible
    const formulaToggle = screen.getByRole("button", {
      name: /show formulas/i,
    })
    fireEvent.click(formulaToggle)

    expect(screen.getByText(/Decode Step Latency/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Decode step time ≈ \(Weight bytes \+ KV bytes read\)/i)
    ).toBeInTheDocument()
  })

  it("handles Challenge section goals and calls onComplete when passed", () => {
    const onComplete = vi.fn()
    renderLevel4(onComplete)

    // Navigate to Challenge section
    fireEvent.click(screen.getByRole("tab", { name: /challenge/i }))

    expect(screen.getByText("Level 4 Challenge")).toBeInTheDocument()
    expect(
      screen.getByText(/Goal 1: Reach ≥ 2,000 tokens\/s while keeping p95 latency ≤ 2\.0 s/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Goal 2: Show that continuous batching beats static at the same batch size/i
      )
    ).toBeInTheDocument()

    // Click comparison button to satisfy Goal 2
    const compareBtn = screen.getByRole("button", {
      name: /compare modes at batch size/i,
    })
    fireEvent.click(compareBtn)

    // With default continuous mode at batch size 24, Goal 1 is passed and Goal 2 is passed
    const completeButton = screen.getByRole("button", {
      name: /complete level 4 challenge/i,
    })
    expect(completeButton).toBeEnabled()

    // Click complete
    fireEvent.click(completeButton)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("does not pass Goal 2 when static and continuous were run under different arrival rates", () => {
    renderLevel4()

    // Navigate to Try
    fireEvent.click(screen.getByRole("tab", { name: /try/i }))

    // Switch to static mode at default arrival rate (30)
    const staticRadio = screen.getByRole("radio", { name: /^static$/i })
    fireEvent.click(staticRadio)

    // Change arrival rate slider to 10
    const arrivalSlider = screen.getByRole("slider", {
      name: /request arrival rate/i,
    })
    fireEvent.change(arrivalSlider, { target: { value: "10" } })

    // Switch to continuous mode at arrival rate 10
    const continuousRadio = screen.getByRole("radio", { name: /^continuous$/i })
    fireEvent.click(continuousRadio)

    // Navigate to Challenge section
    fireEvent.click(screen.getByRole("tab", { name: /challenge/i }))

    // Goal 2 should NOT be passed yet for arrival rate 10 because static was not run at 10
    const incompleteButton = screen.getByRole("button", {
      name: /complete both goals to pass/i,
    })
    expect(incompleteButton).toBeDisabled()
  })

  it("navigates to Recap section and displays key takeaways", () => {
    renderLevel4()

    // Navigate to Recap
    fireEvent.click(screen.getByRole("tab", { name: /recap/i }))

    expect(screen.getByText("Key Takeaways")).toBeInTheDocument()
    expect(screen.getByText(/The Batching Trade-off:/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Continuous Batching Eliminates Idle Gaps:/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/The SLO Decides Your Batch Size:/i)
    ).toBeInTheDocument()
  })
})
