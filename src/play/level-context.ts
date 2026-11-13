import * as React from "react"
import { BookOpen, Sliders, Sparkles, Target } from "lucide-react"
import type { LevelDefinition } from "./types"

export type LevelSection = "learn" | "try" | "challenge" | "recap"

export interface LevelLayoutContextValue {
  level: LevelDefinition
  isCompleted: boolean
  activeSection: LevelSection
  setActiveSection: (section: LevelSection) => void
  onBack: () => void
  onNext?: () => void
}

export const LevelLayoutContext =
  React.createContext<LevelLayoutContextValue | null>(null)

export function useLevelLayout(): LevelLayoutContextValue {
  const context = React.useContext(LevelLayoutContext)
  if (!context) {
    throw new Error("useLevelLayout must be used within a LevelLayout")
  }
  return context
}

export const LEVEL_SECTIONS: Array<{
  id: LevelSection
  number: number
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: "learn", number: 1, label: "Learn", description: "Core concept", icon: BookOpen },
  { id: "try", number: 2, label: "Try", description: "Interactive sandbox", icon: Sliders },
  { id: "challenge", number: 3, label: "Challenge", description: "Hands-on goal", icon: Target },
  { id: "recap", number: 4, label: "Recap", description: "Key takeaway", icon: Sparkles },
]
