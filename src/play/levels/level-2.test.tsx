// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { Level2Component } from "./level-2"
import { LevelLayout } from "../level-layout"
import { level2 } from "./index"

describe("Play Level 2: Prefill vs. Decode", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders Learn section by default with two-phase timeline diagram and arithmetic intuition", () => {
    const onComplete = vi.fn()
    render(
      <LevelLayout level={level2} isCompleted={false} onBack={vi.fn()}>
        <Level2Component onComplete={onComplete} />
      </LevelLayout>
    )

    // Heading and concept description
    expect(
      screen.getByText(/Prefill vs\. Decode: Two Distinct Systems Regimes/i)
    ).toBeInTheDocument()

    // Phase cards
    expect(screen.getByText(/Phase 1: Prefill \(TTFT\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Phase 2: Decode \(Latency\)/i)).toBeInTheDocument()

    // Two-phase diagram presence
    expect(
      screen.getByRole("img", {
        name: /two-phase timeline diagram showing wide prefill block followed by thin decode ticks/i,
      })
    ).toBeInTheDocument()

    // Key intuition arithmetic
    expect(
      screen.getByText(/The Key Intuition: Why Decode Speed is Memory-Bound/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/16 GB weights ÷ 2\.0 TB\/s/i)).toBeInTheDocument()

    // Button to continue to Try
    const continueToTryBtn = screen.getByRole("button", {
      name: /continue to try/i,
    })
    expect(continueToTryBtn).toBeInTheDocument()
    fireEvent.click(continueToTryBtn)

    // Verify transition to Try section
    expect(
      screen.getByText(/Interactive Latency Sandbox/i)
    ).toBeInTheDocument()
  })

  it("conforms to compound control accessible names and role-based test queries in Try section", () => {
    const onComplete = vi.fn()
    render(
      <LevelLayout
        level={level2}
        isCompleted={false}
        onBack={vi.fn()}
        activeSection="try"
      >
        <Level2Component onComplete={onComplete} />
      </LevelLayout>
    )

    // Assert compound controls using accessible role-based queries (AGENTS.md)
    const modelGroup = screen.getByRole("radiogroup", {
      name: /model architecture/i,
    })
    expect(modelGroup).toBeInTheDocument()

    const gpuGroup = screen.getByRole("radiogroup", {
      name: /gpu hardware/i,
    })
    expect(gpuGroup).toBeInTheDocument()

    // Assert compound control items have accessible visible text without redundant aria-label
    expect(
      screen.getByRole("radio", { name: /Llama-3-8B \(8B\)/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("radio", { name: /Llama-3-70B \(70B\)/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("radio", { name: /A100 \(2\.0 TB\/s\)/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("radio", { name: /H100 \(3\.35 TB\/s\)/i })
    ).toBeInTheDocument()

    // Sliders for prompt and output tokens
    expect(
      screen.getByRole("slider", { name: /prompt length tokens/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("slider", { name: /output length tokens/i })
    ).toBeInTheDocument()
  })

  it("updates live latency calculations, timeline bar, and formulas when changing parameters", () => {
    const onComplete = vi.fn()
    render(
      <LevelLayout
        level={level2}
        isCompleted={false}
        onBack={vi.fn()}
        activeSection="try"
      >
        <Level2Component onComplete={onComplete} />
      </LevelLayout>
    )

    // Check initial values for default 8B + A100 (1024 prompt, 256 output)
    // 2 * 8e9 * 1024 / (312e12 * 0.5) ≈ 105 ms TTFT
    expect(screen.getAllByText("105 ms")[0]).toBeInTheDocument()

    // Switch model to 70B
    const model70b = screen.getByRole("radio", { name: /Llama-3-70B \(70B\)/i })
    fireEvent.click(model70b)

    // 70B TTFT: 2 * 70e9 * 1024 / (312e12 * 0.5) ≈ 919 ms
    expect(screen.getAllByText("919 ms")[0]).toBeInTheDocument()

    // Switch GPU to H100
    const gpuH100 = screen.getByRole("radio", { name: /H100 \(3\.35 TB\/s\)/i })
    fireEvent.click(gpuH100)

    // 70B on H100 TTFT: 2 * 70e9 * 1024 / (989e12 * 0.5) ≈ 290 ms
    expect(screen.getAllByText("290 ms")[0]).toBeInTheDocument()

    // Verify side-by-side comparison cards exist
    expect(screen.getByText(/Short Chat/i)).toBeInTheDocument()
    expect(screen.getByText(/Long Summarization/i)).toBeInTheDocument()

    // Simulate timeline button is clickable
    const simulateBtn = screen.getByRole("button", {
      name: /simulate timeline/i,
    })
    fireEvent.click(simulateBtn)
    expect(screen.getByText(/simulating\.\.\./i)).toBeInTheDocument()
  })

  it("evaluates Challenge Goal 1 and Goal 2 and enables completion upon meeting criteria", () => {
    const onComplete = vi.fn()
    render(
      <LevelLayout
        level={level2}
        isCompleted={false}
        onBack={vi.fn()}
        activeSection="challenge"
      >
        <Level2Component onComplete={onComplete} />
      </LevelLayout>
    )

    // Check accessible radiogroups inside Challenge
    expect(
      screen.getByRole("radiogroup", { name: /^model$/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("radiogroup", { name: /^gpu hardware$/i })
    ).toBeInTheDocument()

    // Both goals start in progress (or prompt 4000 on A100 has TTFT = 410 ms > 200 ms)
    const completeBtn = screen.getByRole("button", {
      name: /complete level 2 challenge/i,
    })
    expect(completeBtn).toBeDisabled()

    // Goal 1: "Get TTFT under 200 ms for a 4K-token prompt"
    // Prompt is already at 4000. On 8B + A100, TTFT is ~410 ms (fails).
    // Switching GPU to H100 brings TTFT to 129 ms (< 200 ms).
    const challengeH100 = screen.getByRole("radio", {
      name: /H100 \(989 TFLOPS\)/i,
    })
    fireEvent.click(challengeH100)

    // Goal 1 should now be satisfied!
    expect(screen.getByText("129 ms ✓")).toBeInTheDocument()

    // Goal 2 is not satisfied yet (decode with 10 output tokens is ~71 ms < 129 ms prefill)
    expect(completeBtn).toBeDisabled()

    // Goal 2: "Find a setup where decode, not prefill, dominates total time"
    // Adjust output tokens to 500 so decode dominates
    const output500Btn = screen.getByRole("button", { name: /500 tok/i })
    fireEvent.click(output500Btn)

    // Both goals are now satisfied!
    expect(completeBtn).toBeEnabled()

    // Trigger completion
    fireEvent.click(completeBtn)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("evaluates Goal 2 with short prompt and long output when tested independently", () => {
    const onComplete = vi.fn()
    render(
      <LevelLayout
        level={level2}
        isCompleted={false}
        onBack={vi.fn()}
        activeSection="challenge"
      >
        <Level2Component onComplete={onComplete} />
      </LevelLayout>
    )

    // Goal 2 initially displays an unfulfilled status
    expect(screen.getByText(/\(≤ 50%\)/i)).toBeInTheDocument()

    // Set prompt tokens to 200 via button
    const prompt200Buttons = screen.getAllByRole("button", { name: /200 tok/i })
    fireEvent.click(prompt200Buttons[0]) // first one is prompt tokens

    // Set output tokens to 500 via button
    const output500Btn = screen.getByRole("button", { name: /500 tok/i })
    fireEvent.click(output500Btn)

    // Goal 2 is met: decode dominates
    expect(screen.getByText(/\(Dominates ✓\)/i)).toBeInTheDocument()
  })

  it("displays completed state when isCompleted prop is true", () => {
    const onComplete = vi.fn()
    render(
      <LevelLayout
        level={level2}
        isCompleted={true}
        onBack={vi.fn()}
        activeSection="challenge"
      >
        <Level2Component onComplete={onComplete} />
      </LevelLayout>
    )

    // Completed badge
    expect(screen.getByText("Challenge Complete!")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /challenge completed ✓/i })
    ).toBeDisabled()
  })

  it("renders Recap section with conceptual bullet points", () => {
    const onComplete = vi.fn()
    render(
      <LevelLayout
        level={level2}
        isCompleted={true}
        onBack={vi.fn()}
        activeSection="recap"
      >
        <Level2Component onComplete={onComplete} />
      </LevelLayout>
    )

    expect(screen.getByText(/Key Takeaways/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Long prompts → slow first token \(TTFT\)/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Long outputs → total time dominated by decode/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Workload dictates the system bottleneck/i)
    ).toBeInTheDocument()
    expect(screen.getByText("Ready for Level 3")).toBeInTheDocument()
  })
})
