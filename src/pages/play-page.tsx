import * as React from "react"
import { LEVELS } from "@/play/levels"
import { useProgress } from "@/play/progress"
import { LevelPicker } from "@/play/level-picker"
import { LevelLayout } from "@/play/level-layout"

export function PlayPage() {
  const { completedLevelIds, completeLevel, resetProgress, isCompleted, isUnlocked } =
    useProgress(LEVELS)

  const [selectedLevelId, setSelectedLevelId] = React.useState<string | null>(null)

  const selectedLevel = selectedLevelId
    ? LEVELS.find((l) => l.id === selectedLevelId) ?? null
    : null

  // If a level is selected, find whether a next level exists and is unlocked
  const nextLevel = selectedLevel
    ? LEVELS.find((l) => l.number === selectedLevel.number + 1) ?? null
    : null

  const canNavigateToNext =
    nextLevel !== null &&
    (isUnlocked(nextLevel.id) || isCompleted(selectedLevel?.id ?? ""))

  if (selectedLevel) {
    const Component = selectedLevel.Component
    return (
      <LevelLayout
        level={selectedLevel}
        isCompleted={isCompleted(selectedLevel.id)}
        onBack={() => setSelectedLevelId(null)}
        onNext={
          canNavigateToNext
            ? () => setSelectedLevelId(nextLevel.id)
            : undefined
        }
      >
        <Component onComplete={() => completeLevel(selectedLevel.id)} />
      </LevelLayout>
    )
  }

  return (
    <LevelPicker
      levels={LEVELS}
      completedLevelIds={completedLevelIds}
      onSelectLevel={setSelectedLevelId}
      onResetProgress={resetProgress}
    />
  )
}
