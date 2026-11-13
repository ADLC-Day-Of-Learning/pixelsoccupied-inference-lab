import { CheckCircle2, Lock, Play, RotateCcw } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { LevelDefinition } from "./types"
import { getLevelState } from "./progress"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface LevelPickerProps {
  levels: LevelDefinition[]
  completedLevelIds: string[]
  onSelectLevel: (levelId: string) => void
  onResetProgress: () => void
}

export function LevelPicker({
  levels,
  completedLevelIds,
  onSelectLevel,
  onResetProgress,
}: LevelPickerProps) {
  const progressState = { completedLevelIds }
  const totalLevels = levels.length
  const completedCount = levels.filter((l) =>
    completedLevelIds.includes(l.id)
  ).length
  const progressPct =
    totalLevels > 0 ? Math.round((completedCount / totalLevels) * 100) : 0

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 max-w-5xl mx-auto w-full">
      {/* Overview header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Inference Play</h2>
            <Badge variant="secondary">Interactive</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Master LLM serving systems through hands-on, interactive micro-levels.
          </p>
        </div>

        {/* Progress summary widget */}
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:min-w-64">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-semibold text-foreground">
              {completedCount} of {totalLevels} complete
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={totalLevels}
            />
          </div>
          {completedCount > 0 && (
            <div className="flex justify-end pt-1">
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] text-muted-foreground hover:text-destructive px-1.5 gap-1"
                      aria-label="Reset progress"
                    >
                      <RotateCcw className="size-3" />
                      <span>Reset progress</span>
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset progress?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently erase all completed level progress from this browser. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      render={
                        <Button variant="outline" size="sm">
                          Cancel
                        </Button>
                      }
                    />
                    <AlertDialogAction
                      render={
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={onResetProgress}
                        >
                          Confirm reset
                        </Button>
                      }
                    />
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>

      {/* Grid of level cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {levels.map((level) => {
          const state = getLevelState(progressState, level, levels)
          const isLocked = state === "locked"
          const isCompleted = state === "completed"

          return (
            <button
              type="button"
              key={level.id}
              data-slot="card"
              data-testid={`level-card-${level.id}`}
              data-level-state={state}
              disabled={isLocked}
              aria-disabled={isLocked}
              onClick={() => {
                if (!isLocked) {
                  onSelectLevel(level.id)
                }
              }}
              className={cn(
                "cn-card group/card text-left relative flex flex-col justify-between transition-all rounded-xl border bg-card text-card-foreground shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isLocked
                  ? "opacity-60 bg-muted/30 border-dashed cursor-not-allowed select-none"
                  : "cursor-pointer hover:border-primary/60 hover:shadow-xs",
                isCompleted && "border-emerald-500/40 bg-emerald-500/5"
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    Level {level.number}
                  </span>

                  {isCompleted && (
                    <Badge
                      variant="default"
                      className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 text-[11px] px-2 py-0.5"
                    >
                      <CheckCircle2 className="size-3" />
                      <span>Completed ✓</span>
                    </Badge>
                  )}
                  {state === "available" && (
                    <Badge
                      variant="secondary"
                      className="text-[11px] px-2 py-0.5 gap-1"
                    >
                      <Play className="size-2.5 fill-current" />
                      <span>Available</span>
                    </Badge>
                  )}
                  {isLocked && (
                    <Badge
                      variant="outline"
                      className="text-muted-foreground text-[11px] px-2 py-0.5 gap-1"
                    >
                      <Lock className="size-2.5" />
                      <span>Locked</span>
                    </Badge>
                  )}
                </div>

                <CardTitle className="text-base font-semibold leading-snug mt-1">
                  {level.title}
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-0 text-xs text-muted-foreground space-y-4">
                <p className="leading-relaxed">{level.concept}</p>

                <div className="pt-2 border-t flex items-center justify-between text-[11px] font-medium">
                  {isLocked ? (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Lock className="size-3" />
                      <span>Complete Level {level.number - 1} to unlock</span>
                    </span>
                  ) : isCompleted ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <span>Replay level</span>
                      <span>→</span>
                    </span>
                  ) : (
                    <span className="text-primary font-semibold flex items-center gap-1">
                      <span>Start level</span>
                      <span>→</span>
                    </span>
                  )}
                </div>
              </CardContent>
            </button>
          )
        })}
      </div>
    </div>
  )
}
