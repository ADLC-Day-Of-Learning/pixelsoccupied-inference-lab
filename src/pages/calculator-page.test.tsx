// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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

describe("CalculatorPage context length presets", () => {
  it("defaults to 4K and updates context length when selecting presets", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    // Verify default selection is 4K (4096 tokens)
    const preset4k = screen.getByRole("radio", { name: /4k/i })
    expect(preset4k).toHaveAttribute("data-state", "on")
    expect(screen.getByText(/4,096 tokens\/request/i)).toBeInTheDocument()

    // Numeric input should not be shown for presets
    expect(
      screen.queryByRole("spinbutton", { name: /context length/i })
    ).not.toBeInTheDocument()

    // Selecting 2K updates calculations
    const preset2k = screen.getByRole("radio", { name: /\b2k\b/i })
    await user.click(preset2k)
    expect(preset2k).toHaveAttribute("data-state", "on")
    expect(preset4k).toHaveAttribute("data-state", "off")
    expect(screen.getByText(/2,048 tokens\/request/i)).toBeInTheDocument()

    // Selecting 32K updates calculations
    const preset32k = screen.getByRole("radio", { name: /32k/i })
    await user.click(preset32k)
    expect(preset32k).toHaveAttribute("data-state", "on")
    expect(screen.getByText(/32,768 tokens\/request/i)).toBeInTheDocument()

    // Selecting 128K updates calculations
    const preset128k = screen.getByRole("radio", { name: /128k/i })
    await user.click(preset128k)
    expect(preset128k).toHaveAttribute("data-state", "on")
    expect(screen.getByText(/131,072 tokens\/request/i)).toBeInTheDocument()

    // Selecting 8K updates calculations
    const preset8k = screen.getByRole("radio", { name: /\b8k\b/i })
    await user.click(preset8k)
    expect(preset8k).toHaveAttribute("data-state", "on")
    expect(screen.getByText(/8,192 tokens\/request/i)).toBeInTheDocument()
  })

  it("reveals numeric input when Custom is selected and validates non-positive values", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    // Select Custom option to reveal number input
    const customToggle = screen.getByRole("radio", { name: /custom/i })
    await user.click(customToggle)
    expect(customToggle).toHaveAttribute("data-state", "on")

    const customInput = screen.getByRole("spinbutton", {
      name: /context length/i,
    })
    expect(customInput).toBeInTheDocument()
    expect(customInput).toHaveValue(4096)

    // Entering a valid custom number updates calculations
    await user.clear(customInput)
    await user.type(customInput, "16384")
    expect(screen.getByText(/16,384 tokens\/request/i)).toBeInTheDocument()
    expect(
      screen.queryByText(/must be greater than 0/i)
    ).not.toBeInTheDocument()

    // Values <= 0 show inline error
    await user.clear(customInput)
    await user.type(customInput, "0")
    expect(screen.getByText(/must be greater than 0/i)).toBeInTheDocument()
    expect(customInput).toHaveAttribute("aria-invalid", "true")

    // Negative values show inline error
    await user.clear(customInput)
    await user.type(customInput, "-100")
    expect(screen.getByText(/must be greater than 0/i)).toBeInTheDocument()

    // Clearing input shows inline error
    await user.clear(customInput)
    expect(screen.getByText(/must be greater than 0/i)).toBeInTheDocument()

    // Recovering to a valid positive value clears inline error
    await user.type(customInput, "8192")
    expect(
      screen.queryByText(/must be greater than 0/i)
    ).not.toBeInTheDocument()
    expect(customInput).toHaveAttribute("aria-invalid", "false")
    expect(screen.getByText(/8,192 tokens\/request/i)).toBeInTheDocument()
  })
})
