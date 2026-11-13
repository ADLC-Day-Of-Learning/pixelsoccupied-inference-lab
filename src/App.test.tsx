// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { App } from "./App"

describe("App Navigation and Default View", () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("opens on Play by default, shows Lab in sidebar, and updates header title", () => {
    render(<App />)

    // 1. Opens on Play by default
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Inference Play"
    )
    expect(screen.getByText("0 of 1 complete")).toBeInTheDocument()

    // 2. Sidebar contains Play and Lab
    const labButton = screen.getByRole("button", { name: /^lab$/i })
    const playButton = screen.getByRole("button", { name: /^play$/i })
    expect(labButton).toBeInTheDocument()
    expect(playButton).toBeInTheDocument()

    // 3. Switch to Lab
    fireEvent.click(labButton)

    // 4. Header title changes to "Lab" and renders calculator page
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Lab")
    expect(screen.getByText(/Model Configuration/i)).toBeInTheDocument()

    // 5. Switch back to Play
    fireEvent.click(playButton)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Inference Play"
    )
  })
})
