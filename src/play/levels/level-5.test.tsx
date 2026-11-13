// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { Level5Component } from "./level-5"
import { LevelLayout } from "../level-layout"
import { level5 } from "./index"

function renderLevel5(onComplete = vi.fn()) {
  return {
    onComplete,
    ...render(
      <LevelLayout
        level={level5}
        isCompleted={false}
        onBack={vi.fn()}
      >
        <Level5Component onComplete={onComplete} />
      </LevelLayout>
    ),
  }
}

describe("Level 5: Quantization and model choice", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders Learn section with 2×3 grid diagram showing memory and relative speed", () => {
    renderLevel5()

    expect(
      screen.getByText("Quantization and Model Choice")
    ).toBeInTheDocument()

    // 2x3 Grid headers and content
    expect(
      screen.getByText(/2×3 Grid: Weight Memory & Relative Speed/i)
    ).toBeInTheDocument()
    expect(screen.getByText("FP16 (2 B/param)")).toBeInTheDocument()
    expect(screen.getByText("FP8 (1 B/param)")).toBeInTheDocument()
    expect(screen.getByText("INT4 (0.5 B/param)")).toBeInTheDocument()

    // 8B row: 16 GB, 8 GB, 4 GB
    expect(screen.getByText("16 GB")).toBeInTheDocument()
    expect(screen.getByText("1.0× speed (baseline)")).toBeInTheDocument()
    expect(screen.getByText("8 GB")).toBeInTheDocument()
    expect(screen.getByText("~2.0× speed")).toBeInTheDocument()
    expect(screen.getByText("4 GB")).toBeInTheDocument()
    expect(screen.getByText("~4.0× speed")).toBeInTheDocument()

    // 70B row: 140 GB, 70 GB, 35 GB
    expect(screen.getByText("140 GB")).toBeInTheDocument()
    expect(screen.getByText("70 GB")).toBeInTheDocument()
    expect(screen.getByText("35 GB")).toBeInTheDocument()
  })

  it("navigates to Try section and verifies accessible compound controls using role-based queries", () => {
    renderLevel5()

    // Click tab to open Try section
    const tryTab = screen.getByRole("tab", { name: /try/i })
    fireEvent.click(tryTab)

    expect(
      screen.getByText("Interactive Trade-Off Sandbox")
    ).toBeInTheDocument()

    // Assert accessible names on compound controls (WCAG 2.5.3 role-based queries)
    expect(
      screen.getByRole("radiogroup", { name: /model architecture/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("radiogroup", { name: /weight precision/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("radiogroup", { name: /gpu hardware/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("radiogroup", { name: /gpu count/i })
    ).toBeInTheDocument()

    // Default configuration: 8B FP16 on 1x A100 (80GB)
    expect(screen.getByText("Fits in VRAM")).toBeInTheDocument()
    expect(screen.getByText("80 / 100")).toBeInTheDocument() // 8B FP16 quality score
    expect(screen.getByText(/~88 tokens\/s/i)).toBeInTheDocument()
  })

  it("updates live metrics, cost, and fit when adjusting controls in Try section", () => {
    renderLevel5()

    const tryTab = screen.getByRole("tab", { name: /try/i })
    fireEvent.click(tryTab)

    // Select 70B model
    const model70b = screen.getByRole("radio", { name: /70b/i })
    fireEvent.click(model70b)

    // 70B at FP16 on 1x A100 does not fit!
    expect(screen.getByText("Does not fit")).toBeInTheDocument()
    expect(screen.getByText("100 / 100")).toBeInTheDocument()

    // Select INT4 precision: 70B INT4 (35 GB) fits on 1x A100 (80GB)!
    const int4Radio = screen.getByRole("radio", { name: /int4/i })
    fireEvent.click(int4Radio)

    expect(screen.getByText("Fits in VRAM")).toBeInTheDocument()
    expect(screen.getByText("95 / 100")).toBeInTheDocument() // 70B INT4 quality score
    expect(screen.getByText(/~40 tokens\/s/i)).toBeInTheDocument()
    expect(screen.getByText(/\$15\.28 \/ 1M/i)).toBeInTheDocument() // A100 70B INT4 cost
  })

  it("completes Challenge Goal 1 and Goal 2 and triggers onComplete callback", () => {
    const onComplete = vi.fn()
    renderLevel5(onComplete)

    // Open Challenge section
    const challengeTab = screen.getByRole("tab", { name: /challenge/i })
    fireEvent.click(challengeTab)

    expect(
      screen.getByText("Level 5 Challenge: The Serving Trade-Off")
    ).toBeInTheDocument()

    // Initially neither goal is met (default: 8B FP16 on 1x A100, quality 80 < 95)
    expect(screen.getAllByText("Incomplete")).toHaveLength(2)
    expect(onComplete).not.toHaveBeenCalled()

    // Solve Goal 1: Quality >= 95 and cost <= $15.00/1M tokens
    // Config: 70B + INT4 (quality 95) on H100 ($13.27/1M tokens <= $15.00)
    fireEvent.click(screen.getByRole("radio", { name: /70b/i }))
    fireEvent.click(screen.getByRole("radio", { name: /int4/i }))
    fireEvent.click(screen.getByRole("radio", { name: /h100/i }))

    // Goal 1 is now satisfied!
    expect(screen.getByText("Goal 1 Met ✓")).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled() // Goal 2 still pending

    // Solve Goal 2: Fastest setup with quality >= 79
    // Config: 8B + FP8 (quality 79) on 8x H100 (~2345 tokens/s)
    fireEvent.click(screen.getByRole("radio", { name: /8b/i }))
    fireEvent.click(screen.getByRole("radio", { name: /fp8/i }))
    fireEvent.click(screen.getByRole("radio", { name: "8" }))

    // Goal 2 is now satisfied!
    expect(screen.getByText("Goal 2 Met ✓")).toBeInTheDocument()
    expect(screen.getByText("Goals Met ✓")).toBeInTheDocument()

    // onComplete has been triggered because both goals were achieved
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("renders Recap section with 3 key takeaway bullets", () => {
    renderLevel5()

    const recapTab = screen.getByRole("tab", { name: /recap/i })
    fireEvent.click(recapTab)

    expect(screen.getByText("Key Takeaways")).toBeInTheDocument()
    expect(
      screen.getByText(
        /Quantization trades a little quality for a lot of speed/i
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Bigger-but-quantized often beats smaller-but-full-precision/i
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Always verify quality on your specific domain/i)
    ).toBeInTheDocument()
  })
})
