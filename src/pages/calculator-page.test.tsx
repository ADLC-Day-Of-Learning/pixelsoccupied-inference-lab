// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, afterEach } from "vitest"
import { CalculatorPage } from "@/pages/calculator-page"

afterEach(() => {
  cleanup()
})

describe("CalculatorPage preset dropdowns", () => {
  it("displays human-readable labels instead of internal ids in select triggers", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    const modelTrigger = screen.getByRole("combobox", { name: /model preset/i })
    const gpuTrigger = screen.getByRole("combobox", { name: /gpu preset/i })

    // 1. Initial state displays labels, not raw ids
    expect(modelTrigger).toHaveTextContent("Llama-3-8B")
    expect(modelTrigger).not.toHaveTextContent("llama-3-8b")
    expect(gpuTrigger).toHaveTextContent("NVIDIA A100 80GB")
    expect(gpuTrigger).not.toHaveTextContent("a100-80gb")

    // 2. Select another model preset
    await user.click(modelTrigger)
    const model70bOption = await screen.findByRole("option", {
      name: /llama-3-70b/i,
    })
    await user.click(model70bOption)
    expect(modelTrigger).toHaveTextContent("Llama-3-70B")

    // 3. Select custom model preset
    await user.click(modelTrigger)
    const customModelOption = await screen.findByRole("option", {
      name: /custom dimensions/i,
    })
    await user.click(customModelOption)
    expect(modelTrigger).toHaveTextContent("Custom Dimensions")

    // 4. Select another GPU preset
    await user.click(gpuTrigger)
    const gpuH100Option = await screen.findByRole("option", {
      name: /nvidia h100 80gb/i,
    })
    await user.click(gpuH100Option)
    expect(gpuTrigger).toHaveTextContent("NVIDIA H100 80GB")

    // 5. Select custom GPU preset
    await user.click(gpuTrigger)
    const customGpuOption = await screen.findByRole("option", {
      name: /custom memory/i,
    })
    await user.click(customGpuOption)
    expect(gpuTrigger).toHaveTextContent("Custom Memory")
  })

  it("updates dropdown triggers to Custom labels when input values are manually edited", async () => {
    render(<CalculatorPage />)

    const modelTrigger = screen.getByRole("combobox", { name: /model preset/i })
    const gpuTrigger = screen.getByRole("combobox", { name: /gpu preset/i })

    // Edit model parameter input
    const paramsInput = screen.getByLabelText(/parameters \(billions\)/i)
    fireEvent.change(paramsInput, { target: { value: "14" } })
    expect(modelTrigger).toHaveTextContent("Custom Dimensions")
    expect(modelTrigger).not.toHaveTextContent("custom▼")

    // Edit GPU memory input
    const gpuMemInput = screen.getByLabelText(/memory per gpu/i)
    fireEvent.change(gpuMemInput, { target: { value: "24" } })
    expect(gpuTrigger).toHaveTextContent("Custom Memory")
    expect(gpuTrigger).not.toHaveTextContent("custom▼")
  })
})

describe("CalculatorPage stacked GPU memory bar", () => {
  it("renders the horizontal stacked bar with weights, overhead, and free KV cache when fitting", () => {
    render(<CalculatorPage />)

    // Check card title
    expect(screen.getByText("GPU Memory Allocation")).toBeInTheDocument()

    // Default: Llama-3-8B FP16 (16 GB) on 1x A100 (80 GB), 8 GB overhead -> 56 GB free KV
    expect(screen.getByText(/^Weights:/i).closest("div")).toHaveTextContent(
      "Weights: 16 GB"
    )
    expect(
      screen.getByText(/^Runtime Overhead:/i).closest("div")
    ).toHaveTextContent("Runtime Overhead: 8 GB")
    expect(
      screen.getByText(/^KV Cache \(free\):/i).closest("div")
    ).toHaveTextContent("KV Cache (free): 56 GB")
    expect(
      screen.getByText(/^Total GPU Memory:/i).closest("div")
    ).toHaveTextContent("Total GPU Memory: 80 GB")

    // Accessible text alternative
    const accessibleBar = screen.getByRole("img", {
      name: /gpu memory usage: 16 GB weights/i,
    })
    expect(accessibleBar).toBeInTheDocument()
    expect(accessibleBar).toHaveAttribute(
      "aria-label",
      expect.stringContaining("56 GB free for KV cache")
    )
  })

  it("displays destructive overflow segment and shortfall label when weights + overhead exceed capacity", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    // Switch model to Llama-3-70B (70B FP16 = 140 GB weights on 1x 80GB GPU + 8 GB overhead = 148 GB -> 68 GB over)
    const modelTrigger = screen.getByRole("combobox", { name: /model preset/i })
    await user.click(modelTrigger)
    const model70bOption = await screen.findByRole("option", {
      name: /llama-3-70b/i,
    })
    await user.click(model70bOption)

    // Labeled shortfall: "68 GB over"
    expect(screen.getAllByText(/68 GB over/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/shortfall:/i)).toBeInTheDocument()

    // Accessible text alternative summarizes the shortfall
    const accessibleBar = screen.getByRole("img", {
      name: /exceeding total gpu memory of 80 GB by 68 GB over/i,
    })
    expect(accessibleBar).toBeInTheDocument()

    // Destructive segment is rendered in the bar
    const destructiveSegment = accessibleBar.querySelector(".bg-destructive")
    expect(destructiveSegment).toBeInTheDocument()
    expect(destructiveSegment).toHaveTextContent("68 GB over")

    // Now increase GPU count to 2 (160 GB total: 140 GB weights + 16 GB overhead = 156 GB -> 4 GB free KV)
    const gpuCountInput = screen.getByLabelText(/number of gpus/i)
    fireEvent.change(gpuCountInput, { target: { value: "2" } })

    // Now it fits: shortfall should be gone, free KV should be 4 GB
    expect(screen.queryByText(/shortfall:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/68 GB over/i)).not.toBeInTheDocument()
    expect(
      screen.getByText(/^KV Cache \(free\):/i).closest("div")
    ).toHaveTextContent("KV Cache (free): 4 GB")
    expect(
      screen.getByText(/^Total GPU Memory:/i).closest("div")
    ).toHaveTextContent("Total GPU Memory: 160 GB")

    const updatedAccessibleBar = screen.getByRole("img", {
      name: /gpu memory usage: 140 GB weights/i,
    })
    expect(updatedAccessibleBar).toHaveAttribute(
      "aria-label",
      expect.stringContaining("4 GB free for KV cache")
    )
  })
})
