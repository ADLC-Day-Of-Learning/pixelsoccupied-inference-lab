import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"

describe("Automatic DOM cleanup", () => {
  it("renders an element into the DOM", () => {
    render(<div>Isolated Test Element</div>)
    expect(screen.getByText("Isolated Test Element")).toBeInTheDocument()
  })

  it("ensures DOM is cleared automatically before subsequent tests", () => {
    // Assert prior test's DOM node does not persist in document.body
    expect(screen.queryByText("Isolated Test Element")).not.toBeInTheDocument()

    // Render again and ensure exactly one element exists
    render(<div>Isolated Test Element</div>)
    expect(screen.getByText("Isolated Test Element")).toBeInTheDocument()
  })
})
