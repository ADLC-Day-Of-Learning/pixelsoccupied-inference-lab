import * as React from "react"
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Sparkles,
  Target,
  Zap,
} from "lucide-react"
import type { LevelProps } from "../types"
import { LevelSectionContent, useLevelLayout } from "../level-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  calculateWeightMemory,
  calculateKvCachePerToken,
  estimateDecodeStepTime,
  estimateDecodeTokensPerSecond,
  MODEL_PRESETS,
  GPU_PRESETS,
} from "@/lib/model"

export function Level0Component({ onComplete }: LevelProps) {
  const { setActiveSection, isCompleted } = useLevelLayout()

  // Interactive state for the "Try" sandbox demo
  const [promptTokens, setPromptTokens] = React.useState(512)
  const [hardware, setHardware] = React.useState<"A100" | "H100">("A100")

  // Dynamic preview calculation using canonical pure formulas from src/lib/model.ts
  const model = MODEL_PRESETS[0] // Llama-3-8B
  const gpu =
    GPU_PRESETS.find((g) =>
      hardware === "H100" ? g.id === "h100-80gb" : g.id === "a100-80gb"
    ) ?? GPU_PRESETS[0]

  const weightBytes = calculateWeightMemory(model.parameters, "FP16")
  const kvBytesPerToken = calculateKvCachePerToken(
    model.layers,
    model.kvHeads,
    model.headDim,
    "FP16"
  )
  const kvBytesRead = promptTokens * kvBytesPerToken

  const stepTime = estimateDecodeStepTime({
    weightBytes,
    kvBytesRead,
    memoryBandwidthTb: gpu.memoryBandwidthTb,
  })

  const { perRequestTokensPerSecond } = estimateDecodeTokensPerSecond(stepTime)
  const tokensPerSec = Math.round(perRequestTokensPerSecond)

  return (
    <div className="space-y-6">
      {/* 1. LEARN SECTION */}
      <LevelSectionContent section="learn">
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight">
              Welcome to Inference Play
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Inference Lab breaks down the complex systems mechanics of large
              language model serving into focused, hands-on micro-levels.
              Instead of reading static benchmarks, you will interact with the
              underlying math directly.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <BookOpen className="size-4" />
                  </div>
                  <CardTitle className="text-sm">1. Learn</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed">
                Understand the physical and mathematical intuition behind key
                concepts like KV cache, prefill vs. decode, batching, and
                quantization.
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Zap className="size-4" />
                  </div>
                  <CardTitle className="text-sm">2. Try</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed">
                Experiment freely with interactive sliders, parameters, and
                live calculation formulas to see how hardware limits behave.
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Target className="size-4" />
                  </div>
                  <CardTitle className="text-sm">3. Challenge</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed">
                Solve a concrete serving puzzle (e.g. fitting a 70B model
                within VRAM limits) to verify your mastery and earn completion.
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </div>
                  <CardTitle className="text-sm">4. Recap</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed">
                Review key formulas and rule-of-thumb heuristics before moving
                to the next level.
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={() => setActiveSection("try")}
              className="gap-1.5"
            >
              <span>Continue to Try</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </LevelSectionContent>

      {/* 2. TRY SECTION */}
      <LevelSectionContent section="try">
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">
              Interactive Sandbox Demo
            </h3>
            <p className="text-muted-foreground text-sm">
              Try adjusting the values below to see how interactive controls
              update live model serving estimates.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 rounded-lg border p-4 bg-muted/20">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Prompt Length:</span>
                <span className="font-mono text-xs">{promptTokens} tokens</span>
              </div>
              <input
                type="range"
                min={128}
                max={4096}
                step={128}
                value={promptTokens}
                onChange={(e) => setPromptTokens(Number(e.target.value))}
                className="w-full cursor-pointer"
                aria-label="Prompt length tokens"
              />

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-medium">GPU Architecture:</span>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant={hardware === "A100" ? "default" : "outline"}
                    aria-pressed={hardware === "A100"}
                    onClick={() => setHardware("A100")}
                    className="h-7 text-xs"
                  >
                    A100 (2.0 TB/s)
                  </Button>
                  <Button
                    size="sm"
                    variant={hardware === "H100" ? "default" : "outline"}
                    aria-pressed={hardware === "H100"}
                    onClick={() => setHardware("H100")}
                    className="h-7 text-xs"
                  >
                    H100 (3.3 TB/s)
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-3 flex flex-col justify-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                Estimated Decode Throughput
              </div>
              <div className="text-2xl font-bold tracking-tight text-primary font-mono">
                ~{tokensPerSec} tokens/s
              </div>
              <p className="text-xs text-muted-foreground">
                Llama-3-8B (FP16) reading {Math.round(kvBytesRead / 1e6)} MB KV cache across {promptTokens} prompt tokens at {gpu.memoryBandwidthTb.toFixed(1)} TB/s bandwidth.
              </p>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setActiveSection("learn")}
            >
              Back to Learn
            </Button>
            <Button
              onClick={() => setActiveSection("challenge")}
              className="gap-1.5"
            >
              <span>Continue to Challenge</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </LevelSectionContent>

      {/* 3. CHALLENGE SECTION */}
      <LevelSectionContent section="challenge">
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight">
                Level 0 Challenge: Verify Your Setup
              </h3>
              {isCompleted ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
                  Completed ✓
                </Badge>
              ) : (
                <Badge variant="secondary">Goal</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Each level contains an interactive objective. To complete Level 0,
              confirm that your browser can save level completions by clicking the button below.
            </p>
          </div>

          <Card className={isCompleted ? "border-emerald-500/40 bg-emerald-500/5" : ""}>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    isCompleted
                      ? "bg-emerald-600 text-white"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <Target className="size-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">
                    {isCompleted
                      ? "Challenge Complete!"
                      : "Ready to complete this level?"}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isCompleted
                      ? "You have completed Level 0. Your progress is saved and Level 1 is ready."
                      : "Click the completion button to mark Level 0 as complete. This records your progress in localStorage."}
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={onComplete}
                  disabled={isCompleted}
                  className="gap-2"
                  variant={isCompleted ? "secondary" : "default"}
                >
                  {isCompleted ? (
                    <>
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      <span>Challenge Completed ✓</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      <span>Complete Level 0 Challenge</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setActiveSection("try")}
            >
              Back to Try
            </Button>
            <Button
              onClick={() => setActiveSection("recap")}
              className="gap-1.5"
            >
              <span>View Recap</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </LevelSectionContent>

      {/* 4. RECAP SECTION */}
      <LevelSectionContent section="recap">
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">Key Takeaways</h3>
            <p className="text-muted-foreground text-sm">
              Here is what you learned in Level 0:
            </p>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Learn → Try → Challenge → Recap:</strong> Every level
                follows this four-stage structure to build conceptual intuition
                before testing it.
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Progress Persistence:</strong> Completed levels are
                saved in your browser and automatically unlock subsequent levels.
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Free Navigation:</strong> You can jump between sections
                or revisit completed levels at any time.
              </span>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setActiveSection("challenge")}
            >
              Back to Challenge
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden sm:inline-flex">
                Ready for Level 1
              </Badge>
            </div>
          </div>
        </div>
      </LevelSectionContent>
    </div>
  )
}


