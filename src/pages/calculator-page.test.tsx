import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, describe, it, expect } from "vitest"
import { CalculatorPage } from "@/pages/calculator-page"
import { App } from "@/App"

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

describe("CalculatorPage context length presets", () => {
  it("defaults to 4K and updates context length when selecting presets", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    // Verify radiogroup accessible name
    expect(
      screen.getByRole("radiogroup", { name: /context length/i })
    ).toBeInTheDocument()

    // Verify default selection is 4K (4096 tokens)
    const preset4k = screen.getByRole("radio", { name: /4k/i })
    expect(preset4k).toHaveAttribute("data-state", "on")
    expect(screen.getByText(/@ 4,096 tokens context/i)).toBeInTheDocument()

    // Numeric input should not be shown for presets
    expect(
      screen.queryByRole("spinbutton", { name: /context length/i })
    ).not.toBeInTheDocument()

    // Selecting 2K updates calculations
    const preset2k = screen.getByRole("radio", { name: /\b2k\b/i })
    await user.click(preset2k)
    expect(preset2k).toHaveAttribute("data-state", "on")
    expect(preset4k).toHaveAttribute("data-state", "off")
    expect(screen.getByText(/@ 2,048 tokens context/i)).toBeInTheDocument()

    // Selecting 32K updates calculations
    const preset32k = screen.getByRole("radio", { name: /32k/i })
    await user.click(preset32k)
    expect(preset32k).toHaveAttribute("data-state", "on")
    expect(screen.getByText(/@ 32,768 tokens context/i)).toBeInTheDocument()

    // Selecting 128K updates calculations
    const preset128k = screen.getByRole("radio", { name: /128k/i })
    await user.click(preset128k)
    expect(preset128k).toHaveAttribute("data-state", "on")
    expect(screen.getByText(/@ 131,072 tokens context/i)).toBeInTheDocument()

    // Selecting 8K updates calculations
    const preset8k = screen.getByRole("radio", { name: /\b8k\b/i })
    await user.click(preset8k)
    expect(preset8k).toHaveAttribute("data-state", "on")
    expect(screen.getByText(/@ 8,192 tokens context/i)).toBeInTheDocument()
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
    expect(screen.getByText(/@ 16,384 tokens context/i)).toBeInTheDocument()
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
    expect(screen.getByText(/@ 8,192 tokens context/i)).toBeInTheDocument()
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

describe("CalculatorPage hero result panel", () => {
  it("renders large verdict and headline max concurrent requests when model fits", () => {
    render(<CalculatorPage />)

    const heroPanel = screen.getByTestId("hero-result-panel")
    expect(heroPanel).toBeInTheDocument()

    // Verdict "Fits"
    expect(within(heroPanel).getByText("Fits")).toBeInTheDocument()
    expect(
      within(heroPanel).getByText(/model weights require 16\.0 GB out of 80\.0 GB/i)
    ).toBeInTheDocument()

    // Headline max concurrent requests
    expect(within(heroPanel).getByText("Max Concurrent Requests")).toBeInTheDocument()
    expect(within(heroPanel).getByText("104")).toBeInTheDocument()
    expect(within(heroPanel).getByText(/@ 4,096 tokens context/i)).toBeInTheDocument()

    // Secondary metrics in compact grid
    expect(screen.getByText("Weight Memory")).toBeInTheDocument()
    expect(screen.getByText("KV Cache per Token")).toBeInTheDocument()
    expect(screen.getByText("Free Memory for KV")).toBeInTheDocument()
    expect(screen.getByText("KV Capacity")).toBeInTheDocument()
  })

  it("displays shortfall in GB and 0 concurrent requests when model exceeds capacity", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    // Select Llama-3-70B preset (140 GB weights on 1x 80 GB GPU -> 60 GB shortfall)
    const modelTrigger = screen.getByRole("combobox", { name: /model preset/i })
    await user.click(modelTrigger)
    const model70bOption = await screen.findByRole("option", {
      name: /llama-3-70b/i,
    })
    await user.click(model70bOption)

    const heroPanel = screen.getByTestId("hero-result-panel")

    // Hero panel shows "Does Not Fit"
    expect(within(heroPanel).getByText("Does Not Fit")).toBeInTheDocument()

    // Displays shortfall in GB
    expect(within(heroPanel).getByText(/60\.0 GB Shortfall/i)).toBeInTheDocument()
    expect(
      within(heroPanel).getByText(/weights need 140 GB, but only 80 GB is available/i)
    ).toBeInTheDocument()

    // Max concurrent requests is 0
    expect(within(heroPanel).getByText("0")).toBeInTheDocument()
  })

  it("displays shortfall in GB when model exceeds available memory after overhead", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    // Switch to Custom Dimensions so architecture inputs are displayed
    const modelTrigger = screen.getByRole("combobox", { name: /model preset/i })
    await user.click(modelTrigger)
    const customOption = await screen.findByRole("option", {
      name: /custom dimensions/i,
    })
    await user.click(customOption)

    // Set parameters to 37.5B FP16 (75 GB weights) on 1x 80 GB GPU with 8 GB overhead (72 GB available -> 3 GB shortfall)
    const paramsInput = screen.getByLabelText(/parameters \(billions\)/i)
    fireEvent.change(paramsInput, { target: { value: "37.5" } })

    const heroPanel = screen.getByTestId("hero-result-panel")

    expect(within(heroPanel).getByText("Does Not Fit")).toBeInTheDocument()
    expect(within(heroPanel).getByText(/3\.0 GB Shortfall/i)).toBeInTheDocument()
    expect(
      within(heroPanel).getByText(/weights need 75 GB, but only 72 GB is available after overhead/i)
    ).toBeInTheDocument()
    expect(within(heroPanel).getByText("0")).toBeInTheDocument()
  })

  it("flips from Does Not Fit with shortfall to Fits when GPU count is increased", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    // Select Llama-3-70B on 1x A100 80GB
    const modelTrigger = screen.getByRole("combobox", { name: /model preset/i })
    await user.click(modelTrigger)
    const model70bOption = await screen.findByRole("option", {
      name: /llama-3-70b/i,
    })
    await user.click(model70bOption)

    const heroPanel = screen.getByTestId("hero-result-panel")

    expect(within(heroPanel).getByText("Does Not Fit")).toBeInTheDocument()
    expect(within(heroPanel).getByText(/60\.0 GB Shortfall/i)).toBeInTheDocument()

    // Increase GPU count to 2 (160 GB total memory, 140 GB weights, 16 GB overhead -> 4 GB free)
    const gpu2Btn = screen.getByRole("radio", { name: "2" })
    await user.click(gpu2Btn)

    expect(within(heroPanel).getByText("Fits")).toBeInTheDocument()
    expect(within(heroPanel).queryByText("Does Not Fit")).not.toBeInTheDocument()
    expect(within(heroPanel).queryByText(/shortfall/i)).not.toBeInTheDocument()
    expect(within(heroPanel).getByText("Max Concurrent Requests")).toBeInTheDocument()
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
