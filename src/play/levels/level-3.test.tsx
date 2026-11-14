// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { Level3Component } from "./level-3"
import { level3 } from "./index"
import { LevelLayout } from "../level-layout"

function renderLevel3(isCompleted = false) {
  const handleComplete = vi.fn()
  const handleBack = vi.fn()

  const utils = render(
    <LevelLayout level={level3} isCompleted={isCompleted} onBack={handleBack}>
      <Level3Component onComplete={handleComplete} />
    </LevelLayout>
  )

  return {
    ...utils,
    handleComplete,
    handleBack,
  }
}

describe("Level 3: KV Cache Memory", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders Learn section with GPU memory diagram and jargon definitions", () => {
    renderLevel3()

    expect(
      screen.getByText(/KV Cache Memory: The Real Concurrency Limit/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/GPU Memory Partitioning & Per-Request KV Slices/i)
    ).toBeInTheDocument()
    expect(screen.getByText("Recomputation")).toBeInTheDocument()
    expect(screen.getByText("Preemption")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /continue to try/i })
    ).toBeInTheDocument()
  })

  it("navigates to Try section and renders compound controls with accessible names", () => {
    renderLevel3()

    fireEvent.click(screen.getByRole("tab", { name: /try/i }))

    expect(
      screen.getByText(/KV Cache Memory Simulator/i)
    ).toBeInTheDocument()

    // Assert compound controls using accessible role queries (AGENTS.md rule)
    expect(
      screen.getByRole("radiogroup", { name: /model architecture/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("radiogroup", { name: /gpu hardware/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("radiogroup", { name: /number of gpus/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("radiogroup", { name: /kv cache precision/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("radiogroup", { name: /context length/i })
    ).toBeInTheDocument()

    // Memory gauge progressbar
    expect(
      screen.getByRole("progressbar", { name: /gpu memory allocation gauge/i })
    ).toBeInTheDocument()

    // Active requests indicator
    expect(screen.getByText(/Active Request Slices/i)).toBeInTheDocument()

    // Mathematical formula display
    expect(
      screen.getByText(/Underlying Formulas & Values \(model\.ts\)/i)
    ).toBeInTheDocument()
  })

  it("updates simulation and detects preemption when demand exceeds KV capacity", () => {
    renderLevel3()

    fireEvent.click(screen.getByRole("tab", { name: /try/i }))

    // Initial state: Llama-3-8B on 1x A100 (80GB) with 32 users @ 8K context fits with 0 preemption
    expect(screen.getByRole("status")).toHaveTextContent(
      /All 32 requests served/i
    )

    // Switch model to Llama-3-70B on 1x A100 (80GB) where weights (140GB) exceed 80GB VRAM
    const modelGroup = screen.getByRole("radiogroup", {
      name: /model architecture/i,
    })
    expect(modelGroup).toBeInTheDocument()
    const llama70bBtn = screen.getByRole("radio", { name: "Llama-3-70B" })
    fireEvent.click(llama70bBtn)

    // Preemption alert is displayed explaining eviction and recomputation penalty
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Preemption Detected: 32 of 32 requests preempted!/i
    )
    expect(screen.getByText(/Why this hurts \(Recomputation\)/i)).toBeInTheDocument()
  })

  it("validates Challenge goals and invokes onComplete when both goals are met", () => {
    const { handleComplete } = renderLevel3()

    // On initial mount (on Learn tab), onComplete must not be called
    expect(handleComplete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("tab", { name: /challenge/i }))

    expect(
      screen.getByRole("heading", { name: "Level 3 Challenges", level: 3 })
    ).toBeInTheDocument()

    // Goal 1 controls and initial failing state (L40S 48GB with FP16):
    const goal1GpuGroup = screen.getByRole("radiogroup", {
      name: /select gpu model \(1 gpu\)/i,
    })
    expect(goal1GpuGroup).toBeInTheDocument()
    const goal1KvGroup = screen.getByRole("radiogroup", {
      name: /kv cache precision \(challenge 1\)/i,
    })
    expect(goal1KvGroup).toBeInTheDocument()
    expect(
      screen.getByText(/Failed: 5 requests preempted/i)
    ).toBeInTheDocument()

    // Goal 2 controls and initial failing state (2x A100 80GB with FP16):
    expect(
      screen.getByRole("radiogroup", { name: /gpu count/i })
    ).toBeInTheDocument()
    const goal2KvGroup = screen.getByRole("radiogroup", {
      name: /kv cache precision \(challenge 2\)/i,
    })
    expect(goal2KvGroup).toBeInTheDocument()
    expect(
      screen.getByText(/Failed: 8 requests preempted/i)
    ).toBeInTheDocument()

    // Because goals start in an unsolved state, onComplete should NOT have been called
    expect(handleComplete).not.toHaveBeenCalled()

    // Step 1: Solve Goal 1 by selecting A100 (80GB)
    const a100Btn = within(goal1GpuGroup).getByRole("radio", {
      name: /A100 \(80GB\)/i,
    })
    fireEvent.click(a100Btn)
    expect(screen.getByText(/Goal 1 Passed ✓/i)).toBeInTheDocument()

    // Goal 2 is still incomplete, so onComplete should still not be called
    expect(handleComplete).not.toHaveBeenCalled()

    // Step 2: Solve Goal 2 by changing Goal 2 KV Cache Precision to FP8
    const fp8Btn = within(goal2KvGroup).getByRole("radio", { name: /FP8/i })
    fireEvent.click(fp8Btn)

    expect(screen.getByText(/Goal 2 Passed ✓/i)).toBeInTheDocument()

    // Both goals are now solved -> onComplete is called
    expect(handleComplete).toHaveBeenCalledTimes(1)

    // Verify Goal 2 fails again when switched back to FP16 KV cache
    const fp16Btn = within(goal2KvGroup).getByRole("radio", { name: /FP16/i })
    fireEvent.click(fp16Btn)

    expect(
      screen.getByText(/Failed: 8 requests preempted/i)
    ).toBeInTheDocument()

    // Switch back to FP8 KV cache -> passes again
    fireEvent.click(fp8Btn)
    expect(screen.getByText(/Goal 2 Passed ✓/i)).toBeInTheDocument()
  })

  it("renders Recap section with takeaways and formulas", () => {
    renderLevel3()

    fireEvent.click(screen.getByRole("tab", { name: /recap/i }))

    expect(screen.getByText(/Key Takeaways/i)).toBeInTheDocument()
    expect(
      screen.getByText(/KV Cache per Token Formula/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Context Length × Concurrency is the Real Memory Bill/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/FP8 KV Cache Cuts Memory by 50%/i)
    ).toBeInTheDocument()
  })
})
