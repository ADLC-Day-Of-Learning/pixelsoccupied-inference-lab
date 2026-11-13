// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, describe, it, expect } from "vitest"
import { CalculatorPage } from "@/pages/calculator-page"
import { App } from "@/App"

afterEach(() => {
  cleanup()
})

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
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
    const user = userEvent.setup()
    render(<CalculatorPage />)

    const modelTrigger = screen.getByRole("combobox", { name: /model preset/i })
    const gpuTrigger = screen.getByRole("combobox", { name: /gpu preset/i })

    // Switch model to Custom Dimensions so architecture inputs are displayed
    await user.click(modelTrigger)
    const customModelOption = await screen.findByRole("option", {
      name: /custom dimensions/i,
    })
    await user.click(customModelOption)

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

describe("CalculatorPage GPU count segmented control", () => {
  it("renders 1, 2, 4, 8 options with 1 selected by default and updates selection on click", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    const btn1 = screen.getByRole("radio", { name: "1" })
    const btn2 = screen.getByRole("radio", { name: "2" })
    const btn4 = screen.getByRole("radio", { name: "4" })
    const btn8 = screen.getByRole("radio", { name: "8" })

    expect(btn1).toHaveAttribute("data-state", "on")
    expect(btn1).toHaveAttribute("aria-checked", "true")
    expect(btn2).toHaveAttribute("data-state", "off")
    expect(btn4).toHaveAttribute("data-state", "off")
    expect(btn8).toHaveAttribute("data-state", "off")

    // Click 4 GPUs
    await user.click(btn4)
    expect(btn4).toHaveAttribute("data-state", "on")
    expect(btn4).toHaveAttribute("aria-checked", "true")
    expect(btn1).toHaveAttribute("data-state", "off")

    // Clicking already selected 4 does not deselect it
    await user.click(btn4)
    expect(btn4).toHaveAttribute("data-state", "on")

    // Verify formula card updated for 4 GPUs (e.g. "80 GB × 4")
    expect(screen.getByText(/80 GB × 4/i)).toBeInTheDocument()
  })

  it("supports keyboard navigation between options and selection with Space or Enter", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    const btn1 = screen.getByRole("radio", { name: "1" })
    const btn2 = screen.getByRole("radio", { name: "2" })

    // Focus the initial selected button
    btn1.focus()
    expect(btn1).toHaveFocus()

    // Navigate to next option with ArrowRight
    await user.keyboard("{ArrowRight}")
    expect(btn2).toHaveFocus()

    // Select with Space
    await user.keyboard(" ")
    expect(btn2).toHaveAttribute("data-state", "on")
    expect(btn1).toHaveAttribute("data-state", "off")
    expect(screen.getByText(/80 GB × 2/i)).toBeInTheDocument()
  })
})

describe("Model configuration card architecture fields", () => {
  it("shows a compact read-only summary for presets and editable inputs for custom", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    const modelTrigger = screen.getByRole("combobox", { name: /model preset/i })

    // Default preset (Llama-3-8B): read-only summary shown, inputs and preset badge absent
    expect(
      screen.getByText(/8B params · 32 layers · 8 KV heads · head dim 128/i)
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText(/parameters \(billions\)/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^layers$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/kv heads/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/head dimension/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^preset$/i)).not.toBeInTheDocument()

    // Switch to another preset (Llama-3-70B): summary updates, inputs still hidden
    await user.click(modelTrigger)
    const model70bOption = await screen.findByRole("option", {
      name: /llama-3-70b/i,
    })
    await user.click(model70bOption)

    expect(
      screen.getByText(/70B params · 80 layers · 8 KV heads · head dim 128/i)
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText(/parameters \(billions\)/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/^preset$/i)).not.toBeInTheDocument()

    // Switch to Custom Dimensions: summary disappears, editable inputs appear
    await user.click(modelTrigger)
    const customOption = await screen.findByRole("option", {
      name: /custom dimensions/i,
    })
    await user.click(customOption)

    expect(screen.queryByText(/params ·.*layers/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/parameters \(billions\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^layers$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/kv heads/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/head dimension/i)).toBeInTheDocument()

    // Switch back to preset: inputs are hidden again, summary reappears
    await user.click(modelTrigger)
    const model8bOption = await screen.findByRole("option", {
      name: /llama-3-8b/i,
    })
    await user.click(model8bOption)

    expect(
      screen.getByText(/8B params · 32 layers · 8 KV heads · head dim 128/i)
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText(/parameters \(billions\)/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/^preset$/i)).not.toBeInTheDocument()
  })
})

describe("Calculator disclaimers and unit notes", () => {
  it("removes redundant notices and renders single consolidated footer line in CalculatorPage", () => {
    render(<CalculatorPage />)

    // Top alert banner should be absent
    expect(screen.queryByText(/estimates, not benchmarks/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/1 GB = 1e9 bytes/i)).not.toBeInTheDocument()

    // Single consolidated disclaimer should appear under results
    expect(
      screen.getByText("Rough estimates for learning, not benchmarks. 1 GB = 10⁹ bytes.")
    ).toBeInTheDocument()
  })

  it("removes redundant notices across the app shell", () => {
    render(<App />)

    // Top alert banner and header/sidebar badges/notes should be absent
    expect(screen.queryByText(/estimates, not benchmarks/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/1 GB = 1e9 bytes/i)).not.toBeInTheDocument()

    // Single consolidated disclaimer should appear under results
    expect(
      screen.getByText("Rough estimates for learning, not benchmarks. 1 GB = 10⁹ bytes.")
    ).toBeInTheDocument()
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
    const btn2 = screen.getByRole("radio", { name: "2" })
    await user.click(btn2)

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
