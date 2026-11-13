import * as React from "react"
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react"
import type { LevelDefinition } from "./types"
import {
  LevelLayoutContext,
  LEVEL_SECTIONS,
  useLevelLayout,
  type LevelLayoutContextValue,
  type LevelSection,
} from "./level-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// eslint-disable-next-line react-refresh/only-export-components
export { useLevelLayout } from "./level-context"
export type { LevelSection, LevelLayoutContextValue }

export function LevelSectionContent({
  section,
  children,
}: {
  section: LevelSection
  children: React.ReactNode
}) {
  const { activeSection } = useLevelLayout()
  if (activeSection !== section) return null
  return (
    <div
      role="tabpanel"
      id={`section-panel-${section}`}
      aria-labelledby={`section-tab-${section}`}
      tabIndex={0}
      className="space-y-6 animate-in fade-in duration-200"
    >
      {children}
    </div>
  )
}

export interface LevelLayoutProps {
  level: LevelDefinition
  isCompleted: boolean
  onBack: () => void
  onNext?: () => void
  activeSection?: LevelSection
  onSectionChange?: (section: LevelSection) => void
  children?: React.ReactNode
}

export function LevelLayout({
  level,
  isCompleted,
  onBack,
  onNext,
  activeSection: controlledSection,
  onSectionChange,
  children,
}: LevelLayoutProps) {
  const [internalSection, setInternalSection] = React.useState<LevelSection>("learn")

  const activeSection = controlledSection ?? internalSection

  const handleSectionChange = React.useCallback(
    (section: LevelSection) => {
      if (onSectionChange) {
        onSectionChange(section)
      } else {
        setInternalSection(section)
      }
    },
    [onSectionChange]
  )

  const contextValue = React.useMemo<LevelLayoutContextValue>(
    () => ({
      level,
      isCompleted,
      activeSection,
      setActiveSection: handleSectionChange,
      onBack,
      onNext,
    }),
    [level, isCompleted, activeSection, handleSectionChange, onBack, onNext]
  )

  return (
    <LevelLayoutContext.Provider value={contextValue}>
      <div className="flex-1 space-y-6 p-4 md:p-8 max-w-5xl mx-auto w-full">
        {/* Top header navigation */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="gap-1.5"
              aria-label="Back to levels"
            >
              <ArrowLeft className="size-4" />
              <span>Back to levels</span>
            </Button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Level {level.number}
                </span>
              </div>
              <h2 className="text-lg font-bold tracking-tight sm:text-xl">
                {level.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Challenge status badge */}
            {isCompleted ? (
              <Badge
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 px-2.5 py-1 text-xs"
              >
                <CheckCircle2 className="size-3.5" />
                <span>Complete ✓</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground px-2.5 py-1 text-xs">
                Not yet
              </Badge>
            )}

            {/* Next level button */}
            {onNext && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNext}
                className="gap-1.5"
                aria-label="Next level"
              >
                <span>Next level</span>
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Celebration banner when level is complete */}
        {isCompleted && (
          <div
            data-testid="completion-celebration"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-emerald-950 dark:text-emerald-100 shadow-xs animate-in fade-in zoom-in-95 duration-300"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Sparkles className="size-4 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">
                  Level {level.number} Completed!
                </p>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">
                  Great job mastering this concept. Progress has been saved.
                </p>
              </div>
            </div>
            {onNext && (
              <Button
                size="sm"
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 text-xs"
                onClick={onNext}
              >
                <span>Next level</span>
                <ArrowRight className="size-3.5 ml-1" />
              </Button>
            )}
          </div>
        )}

        {/* Stepper / Tabs navigation */}
        <div
          role="tablist"
          aria-label="Level sections"
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        >
          {LEVEL_SECTIONS.map((section) => {
            const Icon = section.icon
            const isActive = activeSection === section.id
            return (
              <button
                key={section.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`section-panel-${section.id}`}
                id={`section-tab-${section.id}`}
                onClick={() => handleSectionChange(section.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all text-sm",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="leading-none text-xs opacity-75">
                    Step {section.number}
                  </div>
                  <div className="font-medium text-sm leading-tight truncate">
                    {section.label}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Section content */}
        <Card>
          <CardContent className="pt-6">
            {children}
          </CardContent>
        </Card>
      </div>
    </LevelLayoutContext.Provider>
  )
}
