import * as React from "react"

export interface LevelProps {
  onComplete: () => void
}

export interface LevelDefinition {
  id: string // e.g. "sampling"
  number: number // 1..5 (or 0 for placeholder)
  title: string // e.g. "Sampling"
  concept: string // one-line summary shown on the card
  Component: React.ComponentType<LevelProps>
}
