// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { LevelLayout } from "../level-layout"
import { TokensLevelComponent } from "./tokens"
import { level0 } from "./index"

describe("Level 0: TokensLevelComponent", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders Learn, Try, Challenge, and Recap sections via LevelLayout", () => {
    render(
      <LevelLayout level={level0} isCompleted={false} onBack={vi.fn()}>
        <TokensLevelComponent onComplete={vi.fn()} />
      </LevelLayout>
    )

    // Initial section is Learn
    expect(
      screen.getByText("Tokens: What the Model Actually Reads")
    ).toBeInTheDocument()
    expect(screen.getByText("The Tokenization Pipeline")).toBeInTheDocument()

    // Move to Try
    const tryTab = screen.getByRole("tab", { name: /try/i })
    fireEvent.click(tryTab)
    expect(
      screen.getByText("Interactive Tokenizer Sandbox")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("textbox", { name: /input text/i })
    ).toBeInTheDocument()

    // Move to Challenge
    const challengeTab = screen.getByRole("tab", { name: /challenge/i })
    fireEvent.click(challengeTab)
    expect(
      screen.getByText("Goal 1: High-Efficiency Sentence")
    ).toBeInTheDocument()
    expect(screen.getByText("Goal 2: Token-Heavy Word")).toBeInTheDocument()

    // Move to Recap
    const recapTab = screen.getByRole("tab", { name: /recap/i })
    fireEvent.click(recapTab)
    expect(screen.getByText("Key Takeaways")).toBeInTheDocument()
    expect(
      screen.getByText(/Models read and write tokens, not words/i)
    ).toBeInTheDocument()
  })

  it("displays deterministic token IDs [365, 370, 368, 2] in the Learn pipeline diagram", () => {
    render(
      <LevelLayout level={level0} isCompleted={false} onBack={vi.fn()}>
        <TokensLevelComponent onComplete={vi.fn()} />
      </LevelLayout>
    )

    expect(screen.getByText("[365, 370, 368, 2]")).toBeInTheDocument()
  })

  it("exposes aria-pressed selection state on Try preset buttons", () => {
    render(
      <LevelLayout level={level0} isCompleted={false} onBack={vi.fn()}>
        <TokensLevelComponent onComplete={vi.fn()} />
      </LevelLayout>
    )

    fireEvent.click(screen.getByRole("tab", { name: /try/i }))

    const sampleBtn = screen.getByRole("button", { name: /sample sentence/i })
    const numbersBtn = screen.getByRole("button", { name: /numbers/i })

    expect(sampleBtn).toHaveAttribute("aria-pressed", "true")
    expect(numbersBtn).toHaveAttribute("aria-pressed", "false")

    fireEvent.click(numbersBtn)
    expect(sampleBtn).toHaveAttribute("aria-pressed", "false")
    expect(numbersBtn).toHaveAttribute("aria-pressed", "true")
  })

  it("links challenge inputs to constraint instructions via aria-describedby", () => {
    render(
      <LevelLayout level={level0} isCompleted={false} onBack={vi.fn()}>
        <TokensLevelComponent onComplete={vi.fn()} />
      </LevelLayout>
    )

    fireEvent.click(screen.getByRole("tab", { name: /challenge/i }))

    const sentenceInput = screen.getByRole("textbox", {
      name: /your sentence/i,
    })
    const wordInput = screen.getByRole("textbox", {
      name: /your word/i,
    })

    expect(sentenceInput).toHaveAttribute(
      "aria-describedby",
      "challenge-sentence-desc"
    )
    expect(wordInput).toHaveAttribute(
      "aria-describedby",
      "challenge-word-desc"
    )
  })

  it("includes role='status' and aria-live='polite' on completion notification card", () => {
    render(
      <LevelLayout level={level0} isCompleted={false} onBack={vi.fn()}>
        <TokensLevelComponent onComplete={vi.fn()} />
      </LevelLayout>
    )

    fireEvent.click(screen.getByRole("tab", { name: /challenge/i }))

    const statusRegion = screen.getByRole("status")
    expect(statusRegion).toHaveAttribute("aria-live", "polite")
    expect(statusRegion).toHaveTextContent(/complete both goals to pass/i)
  })

  it("trims whitespace for challenge word preview chips so chip count matches token count", () => {
    render(
      <LevelLayout level={level0} isCompleted={false} onBack={vi.fn()}>
        <TokensLevelComponent onComplete={vi.fn()} />
      </LevelLayout>
    )

    fireEvent.click(screen.getByRole("tab", { name: /challenge/i }))

    const wordInput = screen.getByRole("textbox", {
      name: /your word/i,
    })

    // Input word with leading and trailing whitespace
    fireEvent.change(wordInput, { target: { value: "  dog   " } })

    const wordPreview = screen.getByTestId("word-chips-preview")
    expect(wordPreview).toBeInTheDocument()
    // Should render only 1 chip for "dog", not extra whitespace chips
    expect(screen.getByTestId("token-chip-0")).toHaveTextContent("dog")
    expect(screen.queryByTestId("token-chip-1")).not.toBeInTheDocument()
  })

  it("updates live token chips and counts in Try section when typing or choosing presets", () => {
    render(
      <LevelLayout level={level0} isCompleted={false} onBack={vi.fn()}>
        <TokensLevelComponent onComplete={vi.fn()} />
      </LevelLayout>
    )

    // Switch to Try
    fireEvent.click(screen.getByRole("tab", { name: /try/i }))

    const input = screen.getByRole("textbox", { name: /input text/i })
    expect(input).toBeInTheDocument()

    // Default sample text is loaded
    expect(screen.getByTestId("try-token-chips")).toBeInTheDocument()

    // Click "Numbers" preset
    const numbersButton = screen.getByRole("button", { name: /numbers/i })
    fireEvent.click(numbersButton)
    expect(input).toHaveValue("123456789 + 987654321 = 1111111110")

    // Type custom input
    fireEvent.change(input, { target: { value: "Inference is fun!" } })
    expect(input).toHaveValue("Inference is fun!")

    // Chips should render the 4 tokens
    const chip0 = screen.getByTestId("token-chip-0")
    expect(chip0).toHaveTextContent("Inference")
    const chip1 = screen.getByTestId("token-chip-1")
    expect(chip1).toHaveTextContent("␣is")
  })

  it("evaluates Challenge 1 and Challenge 2, and calls onComplete when both pass", () => {
    const handleComplete = vi.fn()

    render(
      <LevelLayout level={level0} isCompleted={false} onBack={vi.fn()}>
        <TokensLevelComponent onComplete={handleComplete} />
      </LevelLayout>
    )

    // Switch to Challenge section
    fireEvent.click(screen.getByRole("tab", { name: /challenge/i }))

    const sentenceInput = screen.getByRole("textbox", {
      name: /your sentence/i,
    })
    const wordInput = screen.getByRole("textbox", {
      name: /your word/i,
    })

    // Initially neither challenge passes
    expect(handleComplete).not.toHaveBeenCalled()
    expect(screen.getAllByText("Incomplete")).toHaveLength(2)

    // Fulfill Challenge 1 (>= 8 words, <= 10 tokens)
    fireEvent.change(sentenceInput, {
      target: { value: "The quick brown fox jumps over the lazy dog." },
    })
    expect(screen.getByText("Goal 1 Passed ✓")).toBeInTheDocument()
    // Challenge 2 still incomplete, so onComplete not yet called
    expect(handleComplete).not.toHaveBeenCalled()

    // Fulfill Challenge 2 (single word with >= 4 tokens)
    fireEvent.change(wordInput, {
      target: { value: "antidisestablishmentarianism" },
    })
    expect(screen.getByText("Goal 2 Passed ✓")).toBeInTheDocument()

    // Now both pass -> onComplete must be called!
    expect(handleComplete).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Level 0 Completed!")).toBeInTheDocument()
  })

  it("cycles token chip color classes across rendered tokens", () => {
    render(
      <LevelLayout level={level0} isCompleted={false} onBack={vi.fn()}>
        <TokensLevelComponent onComplete={vi.fn()} />
      </LevelLayout>
    )

    fireEvent.click(screen.getByRole("tab", { name: /try/i }))

    const chip0 = screen.getByTestId("token-chip-0")
    const chip1 = screen.getByTestId("token-chip-1")
    expect(chip0.className).toContain("text-blue-700")
    expect(chip1.className).toContain("text-emerald-700")
    expect(chip0.className).not.toEqual(chip1.className)
  })
})
