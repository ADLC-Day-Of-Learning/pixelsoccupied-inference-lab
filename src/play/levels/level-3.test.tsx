// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
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
    expect(
      screen.getByText(/All 32 requests served/i)
    ).toBeInTheDocument()

    // Switch model to Llama-3-70B on 1x A100 (80GB) where weights (140GB) exceed 80GB VRAM
    const modelGroup = screen.getByRole("radiogroup", {
      name: /model architecture/i,
    })
    expect(modelGroup).toBeInTheDocument()
    const llama70bBtn = screen.getByRole("radio", { name: "Llama-3-70B" })
    fireEvent.click(llama70bBtn)

    // Preemption alert is displayed explaining eviction and recomputation penalty
    expect(
      screen.getByText(/Preemption Detected: 32 of 32 requests preempted!/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/Why this hurts \(Recomputation\)/i)).toBeInTheDocument()
  })

  it("validates Challenge goals and invokes onComplete when both goals are met", () => {
    const { handleComplete } = renderLevel3()

    fireEvent.click(screen.getByRole("tab", { name: /challenge/i }))

    expect(
      screen.getByRole("heading", { name: "Level 3 Challenges", level: 3 })
    ).toBeInTheDocument()

    // Goal 1 controls and initial state:
    // Goal 1 default: 1x A100 80GB, FP16 -> Llama-3-8B 32 users @ 8K fits (Goal 1 Passed)
    expect(
      screen.getByRole("radiogroup", {
        name: /select gpu model \(1 gpu\)/i,
      })
    ).toBeInTheDocument()
    expect(screen.getByText(/Goal 1 Passed ✓/i)).toBeInTheDocument()

    // Goal 2 default: 2x A100 80GB with FP8 KV cache -> Llama-3-70B 16 users @ 4K fits with 2 GPUs (Goal 2 Passed)
    expect(
      screen.getByRole("radiogroup", { name: /gpu count/i })
    ).toBeInTheDocument()
    expect(screen.getByText(/Goal 2 Passed ✓/i)).toBeInTheDocument()

    // Because both goals are initially satisfied by their default challenge settings,
    // onComplete should have been called
    expect(handleComplete).toHaveBeenCalled()

    // Now test changing Goal 2 to FP16 KV cache to verify fail state
    const goal2KvGroup = screen.getAllByRole("radiogroup", {
      name: /kv cache precision/i,
    })[1]
    expect(goal2KvGroup).toBeInTheDocument()
    const fp16Btn = screen.getAllByRole("radio", { name: /FP16/i })[1]
    fireEvent.click(fp16Btn)

    // Incomplete badge appears because FP16 KV cache preempts on 2 GPUs
    expect(
      screen.getByText(/Failed: 8 requests preempted/i)
    ).toBeInTheDocument()

    // Switch back to FP8 KV cache -> passes again
    const fp8Btn = screen.getAllByRole("radio", { name: /FP8/i })[1]
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
