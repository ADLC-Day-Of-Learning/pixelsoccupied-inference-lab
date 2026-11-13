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

describe("CalculatorPage formula collapsibles and unit display", () => {
  it("keeps formula details collapsed by default and reveals them upon toggle", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    // Formula blocks should not be visible by default
    expect(screen.queryByText(/parameters × bytes_per_param/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/2 × layers × kv_heads × head_dim/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\(gpu_memory × gpus\) − weight_memory − overhead/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/free_memory ÷ kv_per_token/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/floor\(kv_capacity ÷ context_length\)/i)).not.toBeInTheDocument()

    // Exactly 5 toggles, one for each output metric card
    const toggles = screen.getAllByRole("button", { name: /how is this calculated\?/i })
    expect(toggles).toHaveLength(5)

    // Expanding the first toggle reveals the weight memory formula
    await user.click(toggles[0])
    expect(await screen.findByText(/parameters × bytes_per_param/i)).toBeVisible()

    // Clicking again collapses it
    await user.click(toggles[0])
    expect(screen.queryByText(/parameters × bytes_per_param/i)).not.toBeInTheDocument()
  })

  it("displays explicit conversion units in the KV capacity formula when toggles are expanded", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    const toggles = screen.getAllByRole("button", { name: /how is this calculated\?/i })
    for (const toggle of toggles) {
      await user.click(toggle)
    }

    // Verify all formula blocks become visible
    expect(await screen.findByText(/parameters × bytes_per_param/i)).toBeVisible()
    expect(await screen.findByText(/2 × layers × kv_heads × head_dim/i)).toBeVisible()
    expect(await screen.findByText(/\(gpu_memory × gpus\) − weight_memory − overhead/i)).toBeVisible()
    expect(await screen.findByText(/free_memory ÷ kv_per_token/i)).toBeVisible()
    expect(await screen.findByText(/floor\(kv_capacity ÷ context_length\)/i)).toBeVisible()

    // Verify the formula indicates the 10^9 conversion factor
    const conversionNotice = await screen.findByText(/10[⁹9] B\/GB/)
    expect(conversionNotice).toBeInTheDocument()
  })

  it("allows opening and closing individual metric formula toggles independently", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    const toggles = screen.getAllByRole("button", { name: /how is this calculated\?/i })

    // Open only the second card (KV cache per token)
    await user.click(toggles[1])
    expect(await screen.findByText(/2 × layers × kv_heads × head_dim/i)).toBeVisible()
    expect(screen.queryByText(/parameters × bytes_per_param/i)).not.toBeInTheDocument()

    // Open the fifth card (Max concurrent requests)
    await user.click(toggles[4])
    expect(await screen.findByText(/floor\(kv_capacity ÷ context_length\)/i)).toBeVisible()

    // Close the second card
    await user.click(toggles[1])
    expect(screen.queryByText(/2 × layers × kv_heads × head_dim/i)).not.toBeInTheDocument()
    // Fifth card is still open
    expect(screen.getByText(/floor\(kv_capacity ÷ context_length\)/i)).toBeVisible()
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
