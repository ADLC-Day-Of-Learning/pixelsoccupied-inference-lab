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
})
