import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, describe, it, expect, vi } from "vitest"
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

    // Exactly 5 toggles, one for each output metric
    const toggles = screen.getAllByRole("button", { name: /how is this calculated\?/i })
    expect(toggles).toHaveLength(5)

    // Expanding the weight memory toggle reveals its formula
    const weightToggle = screen.getByRole("button", {
      name: "How is this calculated? (Weight Memory)",
    })
    await user.click(weightToggle)
    expect(await screen.findByText(/parameters × bytes_per_param/i)).toBeVisible()

    // Clicking again collapses it
    await user.click(weightToggle)
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

    const kvToggle = screen.getByRole("button", {
      name: "How is this calculated? (KV Cache per Token)",
    })
    const maxConcurrencyToggle = screen.getByRole("button", {
      name: "How is this calculated? (Max Concurrent Requests)",
    })

    // Open only the KV cache per token toggle
    await user.click(kvToggle)
    expect(await screen.findByText(/2 × layers × kv_heads × head_dim/i)).toBeVisible()
    expect(screen.queryByText(/parameters × bytes_per_param/i)).not.toBeInTheDocument()

    // Open the Max concurrent requests toggle
    await user.click(maxConcurrencyToggle)
    expect(await screen.findByText(/floor\(kv_capacity ÷ context_length\)/i)).toBeVisible()

    // Close the KV cache toggle
    await user.click(kvToggle)
    expect(screen.queryByText(/2 × layers × kv_heads × head_dim/i)).not.toBeInTheDocument()
    // Max concurrent requests is still open
    expect(screen.getByText(/floor\(kv_capacity ÷ context_length\)/i)).toBeVisible()
  })

  it("provides distinct accessible names for each formula toggle while preserving visible label", () => {
    render(<CalculatorPage />)

    expect(
      screen.getByRole("button", {
        name: "How is this calculated? (Weight Memory)",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "How is this calculated? (KV Cache per Token)",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "How is this calculated? (Free Memory for KV)",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "How is this calculated? (KV Capacity)",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "How is this calculated? (Max Concurrent Requests)",
      })
    ).toBeInTheDocument()
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
    const freeMemToggle = screen.getByRole("button", {
      name: "How is this calculated? (Free Memory for KV)",
    })
    await user.click(freeMemToggle)
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

    const freeMemToggle = screen.getByRole("button", {
      name: "How is this calculated? (Free Memory for KV)",
    })
    await user.click(freeMemToggle)
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

    // Verdict "Fits" in accessible status live region
    const statusRegion = within(heroPanel).getByRole("status")
    expect(statusRegion).toHaveAttribute("aria-live", "polite")
    expect(statusRegion).toHaveAttribute("aria-atomic", "true")
    expect(within(statusRegion).getByText("Fits")).toBeInTheDocument()
    expect(
      within(statusRegion).getByText(/model weights require 16\.0 GB out of 80\.0 GB/i)
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

    // Select Llama-3-70B preset (140 GB weights on 1x 80 GB GPU with 8 GB overhead -> 68 GB shortfall)
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
    expect(within(heroPanel).getByText(/68\.0 GB Shortfall/i)).toBeInTheDocument()
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
    expect(within(heroPanel).getByText(/68\.0 GB Shortfall/i)).toBeInTheDocument()

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

    // Switch to Lab view to show calculator outputs
    fireEvent.click(screen.getByRole("button", { name: /^lab$/i }))

    // Single consolidated disclaimer should appear under results
    expect(
      screen.getByText("Rough estimates for learning, not benchmarks. 1 GB = 10⁹ bytes.")
    ).toBeInTheDocument()
  })
})

describe("CalculatorPage stacked GPU memory bar", () => {
  it("renders the horizontal stacked bar with weights, overhead, and free KV cache when fitting", () => {
    render(<CalculatorPage />)

    // Check card title and decorative icon
    const cardTitle = screen.getByText("GPU Memory Allocation")
    expect(cardTitle).toBeInTheDocument()
    const icon = cardTitle.querySelector("svg")
    expect(icon).toHaveAttribute("aria-hidden", "true")

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

    // The weights segment inside the bar renders fitted capacity (80 GB), not unpartitioned total (140 GB)
    const weightsSegment = accessibleBar.querySelector(".bg-blue-600, .bg-blue-500")
    expect(weightsSegment).toHaveTextContent("80 GB")

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

describe("CalculatorPage mobile sticky summary bar", () => {
  it("renders verdict and max concurrent requests in sticky summary bar with md:hidden", () => {
    render(<CalculatorPage />)

    const summaryBar = screen.getByTestId("mobile-sticky-summary")
    expect(summaryBar).toBeInTheDocument()
    expect(summaryBar).toHaveClass("md:hidden")
    expect(summaryBar).toHaveClass("sticky")
    expect(summaryBar).toHaveClass("bottom-0")

    // Button has accessible role and name indicating fit and concurrency
    const summaryButton = within(summaryBar).getByRole("button", {
      name: /fits.*104 requests.*scroll to full results/i,
    })
    expect(summaryButton).toBeInTheDocument()
    expect(within(summaryBar).getByText("Fits")).toBeInTheDocument()
    expect(within(summaryBar).getByText("104")).toBeInTheDocument()
    expect(within(summaryBar).getByText("requests")).toBeInTheDocument()
  })

  it("updates verdict and max concurrent requests dynamically when inputs change", async () => {
    const user = userEvent.setup()
    render(<CalculatorPage />)

    const summaryBar = screen.getByTestId("mobile-sticky-summary")

    // Initially fits
    expect(within(summaryBar).getByText("Fits")).toBeInTheDocument()
    expect(within(summaryBar).getByText("104")).toBeInTheDocument()

    // Change model preset to Llama-3-70B (doesn't fit on 1x 80GB GPU)
    const modelTrigger = screen.getByRole("combobox", { name: /model preset/i })
    await user.click(modelTrigger)
    const model70bOption = await screen.findByRole("option", {
      name: /llama-3-70b/i,
    })
    await user.click(model70bOption)

    // Summary bar immediately reflects "Does Not Fit", shortfall, and 0 requests
    expect(within(summaryBar).getByText("Does Not Fit")).toBeInTheDocument()
    expect(within(summaryBar).getByText(/68\.0 GB Shortfall/i)).toBeInTheDocument()
    expect(within(summaryBar).getByText("0")).toBeInTheDocument()
    expect(
      within(summaryBar).getByRole("button", {
        name: /does not fit.*68\.0 gb shortfall.*0 requests.*scroll to full results/i,
      })
    ).toBeInTheDocument()

    // Increase GPU count to 2 -> flips back to Fits
    const gpu2Btn = screen.getByRole("radio", { name: "2" })
    await user.click(gpu2Btn)

    expect(within(summaryBar).getByText("Fits")).toBeInTheDocument()
    expect(within(summaryBar).queryByText("Does Not Fit")).not.toBeInTheDocument()
    expect(within(summaryBar).queryByText(/shortfall/i)).not.toBeInTheDocument()
    expect(within(summaryBar).getByText("requests")).toBeInTheDocument()
  })

  it("triggers smooth scrollIntoView on the results section when tapped", async () => {
    const user = userEvent.setup()
    const scrollIntoViewMock = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

    render(<CalculatorPage />)

    const summaryBar = screen.getByTestId("mobile-sticky-summary")
    const summaryButton = within(summaryBar).getByRole("button", {
      name: /scroll to full results/i,
    })

    await user.click(summaryButton)

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" })
  })
})

