// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
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
    const gpuCountInput = screen.getByLabelText(/number of gpus/i)
    fireEvent.change(gpuCountInput, { target: { value: "2" } })

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
