// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, it, expect } from "vitest"
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
