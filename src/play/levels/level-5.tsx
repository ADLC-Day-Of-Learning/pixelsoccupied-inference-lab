import * as React from "react"
import {
  ArrowRight,
  CheckCircle2,
  DollarSign,
  HardDrive,
  Sparkles,
  Star,
  Target,
  Zap,
} from "lucide-react"
import type { LevelProps } from "../types"
import { LevelSectionContent, useLevelLayout } from "../level-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  calculateWeightMemory,
  estimateDecodeStepTime,
  estimateDecodeTokensPerSecond,
  evaluateMemoryFit,
  getToyQualityScore,
  getGpuHourlyCost,
  calculateCostPer1MTokens,
  evaluateLevel5Challenge1,
  evaluateLevel5Challenge2,
  MODEL_PRESETS,
  GPU_PRESETS,
  BYTES_PER_PARAM,
  type WeightPrecision,
} from "@/lib/model"

export function Level5Component({ onComplete }: LevelProps) {
  const { setActiveSection, isCompleted } = useLevelLayout()

  // Interactive controls state
  const [modelId, setModelId] = React.useState<string>("llama-3-8b")
  const [precision, setPrecision] = React.useState<WeightPrecision>("FP16")
  const [gpuId, setGpuId] = React.useState<string>("a100-80gb")
  const [gpuCount, setGpuCount] = React.useState<number>(1)

  // Challenge goal completion persistence across settings
  const [goal1Achieved, setGoal1Achieved] = React.useState<boolean>(false)
  const [goal2Achieved, setGoal2Achieved] = React.useState<boolean>(false)

  // Model & hardware lookups
  const model =
    MODEL_PRESETS.find((m) => m.id === modelId) ?? MODEL_PRESETS[0]
  const gpu = GPU_PRESETS.find((g) => g.id === gpuId) ?? GPU_PRESETS[0]
  const hourlyRate = getGpuHourlyCost(gpu.id)

  // Math derivations
  const weightBytes = calculateWeightMemory(model.parameters, precision)
  const weightGb = weightBytes / 1e9
  const totalGpuMemoryBytes = gpu.memoryGb * 1e9 * gpuCount

  const memoryFit = evaluateMemoryFit({
    parameters: model.parameters,
    precision,
    totalGpuMemoryBytes,
    overheadFraction: 0.1,
  })

  const fits = memoryFit.fits

  const stepTimeSeconds = fits
    ? estimateDecodeStepTime({
        weightBytes,
        kvBytesRead: 0,
        memoryBandwidthTb: gpu.memoryBandwidthTb,
        gpuCount,
      })
    : 0

  const tokensPerSecond = fits
    ? estimateDecodeTokensPerSecond(stepTimeSeconds).perRequestTokensPerSecond
    : 0

  const costPer1MTokens = fits
    ? calculateCostPer1MTokens({
        costPerHourPerGpu: hourlyRate,
        gpuCount,
        tokensPerSecond,
      })
    : 0

  const qualityScore = getToyQualityScore(model.id, precision)

  // Live evaluation of challenge goals
  const isGoal1Met = evaluateLevel5Challenge1({
    qualityScore,
    costPer1MTokens,
    fits,
  })

  const isGoal2Met = evaluateLevel5Challenge2({
    qualityScore,
    tokensPerSecond,
    fits,
  })

  // Automatically remember met goals
  React.useEffect(() => {
    if (isGoal1Met) {
      setGoal1Achieved(true)
    }
  }, [isGoal1Met])

  React.useEffect(() => {
    if (isGoal2Met) {
      setGoal2Achieved(true)
    }
  }, [isGoal2Met])

  const bothGoalsMet =
    (goal1Achieved || isGoal1Met) && (goal2Achieved || isGoal2Met)

  // Trigger level completion once both goals are met
  React.useEffect(() => {
    if (bothGoalsMet && !isCompleted) {
      onComplete()
    }
  }, [bothGoalsMet, isCompleted, onComplete])

  return (
    <div className="space-y-6">
      {/* 1. LEARN SECTION */}
      <LevelSectionContent section="learn">
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight">
              Quantization and Model Choice
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Serving an LLM is a fundamental trade-off between output quality,
              latency, and serving cost. Smaller models and lower numerical
              precisions generate tokens faster and cheaper, but cost output
              fidelity.
            </p>
          </div>

          {/* Core concept explanation */}
          <div className="rounded-lg border bg-muted/20 p-4 space-y-2 text-sm">
            <p className="leading-relaxed">
              <strong>Memory-bandwidth bound decode:</strong> Generating each
              token requires reading every parameter in the model from GPU
              high-bandwidth memory (HBM).
            </p>
            <p className="leading-relaxed">
              <strong>What is quantization?</strong> Quantization represents
              weights with fewer bits—converting 16-bit floats (FP16, 2 bytes)
              to 8-bit floats (FP8, 1 byte) or 4-bit integers (INT4, 0.5 bytes).
              Cutting weight bytes in half roughly doubles decode tokens per
              second.
            </p>
            <p className="leading-relaxed">
              <strong>Quality vs. size heuristic:</strong> A larger model
              quantized to 4 bits often produces higher quality output than a
              smaller model at full 16-bit precision, while fitting into a
              fraction of the hardware.
            </p>
          </div>

          {/* 2x3 Grid Diagram */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold tracking-wide">
                2×3 Grid: Weight Memory & Relative Speed
              </h4>
              <span className="text-xs text-muted-foreground">
                Relative to 8B FP16 baseline
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b text-muted-foreground font-medium">
                  <tr>
                    <th className="p-3">Model</th>
                    <th className="p-3">FP16 (2 B/param)</th>
                    <th className="p-3">FP8 (1 B/param)</th>
                    <th className="p-3">INT4 (0.5 B/param)</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  <tr>
                    <td className="p-3 font-sans font-semibold">
                      <div>Llama-3-8B</div>
                      <div className="text-[11px] text-muted-foreground font-normal">
                        8 Billion params
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-foreground">16 GB</div>
                      <div className="text-muted-foreground text-[11px]">
                        1.0× speed (baseline)
                      </div>
                    </td>
                    <td className="p-3 bg-primary/5">
                      <div className="font-semibold text-primary">8 GB</div>
                      <div className="text-emerald-600 dark:text-emerald-400 text-[11px]">
                        ~2.0× speed
                      </div>
                    </td>
                    <td className="p-3 bg-primary/10">
                      <div className="font-semibold text-primary">4 GB</div>
                      <div className="text-emerald-600 dark:text-emerald-400 text-[11px]">
                        ~4.0× speed
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-sans font-semibold">
                      <div>Llama-3-70B</div>
                      <div className="text-[11px] text-muted-foreground font-normal">
                        70 Billion params
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-foreground">140 GB</div>
                      <div className="text-muted-foreground text-[11px]">
                        Needs 2+ GPUs (0.11×)
                      </div>
                    </td>
                    <td className="p-3 bg-primary/5">
                      <div className="font-semibold text-primary">70 GB</div>
                      <div className="text-muted-foreground text-[11px]">
                        Fits 1× 80GB (~2× vs FP16)
                      </div>
                    </td>
                    <td className="p-3 bg-primary/10">
                      <div className="font-semibold text-primary">35 GB</div>
                      <div className="text-muted-foreground text-[11px]">
                        Fits 1× 48GB (~4× vs FP16)
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
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
        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">
              Interactive Trade-Off Sandbox
            </h3>
            <p className="text-muted-foreground text-sm">
              Explore how choosing different model sizes, precision formats,
              and GPU clusters impacts memory fit, decode throughput, cost, and
              quality.
            </p>
          </div>

          {/* Controls */}
          <div className="grid gap-4 sm:grid-cols-2 rounded-lg border p-4 bg-muted/20">
            {/* Model Architecture */}
            <div className="space-y-2">
              <Label id="level5-model-label">Model Architecture</Label>
              <ToggleGroup
                id="level5-model"
                aria-labelledby="level5-model-label"
                type="single"
                value={modelId}
                onValueChange={(val: string) => {
                  if (val) setModelId(val)
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="llama-3-8b" className="flex-1 text-xs">
                  8B (Llama-3-8B)
                </ToggleGroupItem>
                <ToggleGroupItem value="llama-3-70b" className="flex-1 text-xs">
                  70B (Llama-3-70B)
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Weight Precision */}
            <div className="space-y-2">
              <Label id="level5-precision-label">Weight Precision</Label>
              <ToggleGroup
                id="level5-precision"
                aria-labelledby="level5-precision-label"
                type="single"
                value={precision}
                onValueChange={(val: string) => {
                  if (val) setPrecision(val as WeightPrecision)
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="FP16" className="flex-1 text-xs">
                  FP16 (16-bit)
                </ToggleGroupItem>
                <ToggleGroupItem value="FP8" className="flex-1 text-xs">
                  FP8 (8-bit)
                </ToggleGroupItem>
                <ToggleGroupItem value="INT4" className="flex-1 text-xs">
                  INT4 (4-bit)
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* GPU Hardware */}
            <div className="space-y-2">
              <Label id="level5-gpu-label">GPU Hardware</Label>
              <ToggleGroup
                id="level5-gpu"
                aria-labelledby="level5-gpu-label"
                type="single"
                value={gpuId}
                onValueChange={(val: string) => {
                  if (val) setGpuId(val)
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="a100-80gb" className="flex-1 text-xs">
                  A100 (80GB · $2.20/hr)
                </ToggleGroupItem>
                <ToggleGroupItem value="h100-80gb" className="flex-1 text-xs">
                  H100 (80GB · $3.20/hr)
                </ToggleGroupItem>
                <ToggleGroupItem value="l40s-48gb" className="flex-1 text-xs">
                  L40S (48GB · $1.10/hr)
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* GPU Count */}
            <div className="space-y-2">
              <Label id="level5-gpu-count-label">GPU Count</Label>
              <ToggleGroup
                id="level5-gpu-count"
                aria-labelledby="level5-gpu-count-label"
                type="single"
                value={String(gpuCount)}
                onValueChange={(val: string) => {
                  if (val) setGpuCount(parseInt(val, 10))
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="1" className="flex-1">
                  1
                </ToggleGroupItem>
                <ToggleGroupItem value="2" className="flex-1">
                  2
                </ToggleGroupItem>
                <ToggleGroupItem value="4" className="flex-1">
                  4
                </ToggleGroupItem>
                <ToggleGroupItem value="8" className="flex-1">
                  8
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {/* Metric Outputs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Memory Fit */}
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider">
                    Memory Fit
                  </span>
                  <HardDrive className="size-4" />
                </div>
                <CardTitle className="text-lg font-bold font-mono">
                  {fits ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Fits in VRAM
                    </span>
                  ) : (
                    <span className="text-destructive">Does not fit</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <p className="text-muted-foreground">
                  Weights: <span className="font-mono font-semibold">{weightGb.toFixed(1)} GB</span> /{" "}
                  VRAM: <span className="font-mono">{(gpu.memoryGb * gpuCount).toFixed(0)} GB</span>
                </p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {model.parametersBillions}B × {BYTES_PER_PARAM[precision]} B/param = {weightGb.toFixed(0)} GB
                </p>
              </CardContent>
            </Card>

            {/* 2. Decode Throughput */}
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider">
                    Decode Speed
                  </span>
                  <Zap className="size-4" />
                </div>
                <CardTitle className="text-lg font-bold font-mono">
                  {fits ? (
                    <span>~{Math.round(tokensPerSecond)} tokens/s</span>
                  ) : (
                    <span className="text-muted-foreground">0 tokens/s</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <p className="text-muted-foreground">
                  {fits
                    ? `Step time: ${(stepTimeSeconds * 1000).toFixed(1)} ms/token`
                    : "Insufficient GPU memory"}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {fits
                    ? `${weightGb.toFixed(0)}GB ÷ (${gpu.memoryBandwidthTb}TB/s × ${gpuCount} × 0.7)`
                    : "OOM"}
                </p>
              </CardContent>
            </Card>

            {/* 3. Serving Cost */}
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider">
                    Serving Cost
                  </span>
                  <DollarSign className="size-4" />
                </div>
                <CardTitle className="text-lg font-bold font-mono">
                  {fits ? (
                    <span>${costPer1MTokens.toFixed(2)} / 1M</span>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <p className="text-muted-foreground">
                  ${(hourlyRate * gpuCount).toFixed(2)}/hr ({gpuCount}× ${hourlyRate.toFixed(2)})
                </p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {fits
                    ? `(${(hourlyRate * gpuCount).toFixed(2)}/hr) ÷ (${Math.round((tokensPerSecond * 3600) / 1000)}k tok/hr)`
                    : "Cannot serve"}
                </p>
              </CardContent>
            </Card>

            {/* 4. Illustrative Quality */}
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider">
                    Quality Score
                  </span>
                  <Star className="size-4" />
                </div>
                <CardTitle className="text-lg font-bold font-mono text-primary">
                  {qualityScore} / 100
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <p className="text-muted-foreground">
                  {model.name} at {precision}
                </p>
                <p className="text-[11px] text-muted-foreground italic">
                  Illustrative benchmark score
                </p>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Rough estimates for learning, not benchmarks. 1 GB = 10⁹ bytes. Fixed GPU hourly rental costs are illustrative cloud market rates.
          </p>

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
        <div className="space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight">
                Level 5 Challenge: The Serving Trade-Off
              </h3>
              {isCompleted ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
                  Completed ✓
                </Badge>
              ) : bothGoalsMet ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
                  Goals Met ✓
                </Badge>
              ) : (
                <Badge variant="secondary">2 Goals</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Solve two serving challenges by finding hardware and quantization
              combinations that achieve targeted quality, cost, and latency.
            </p>
          </div>

          {/* Goal 1 Card */}
          <Card
            className={
              goal1Achieved || isGoal1Met
                ? "border-emerald-500/40 bg-emerald-500/5"
                : ""
            }
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                      goal1Achieved || isGoal1Met
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    1
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    Goal 1: Quality ≥ 95 and Cost ≤ $15.00 per 1M tokens
                  </CardTitle>
                </div>
                {goal1Achieved || isGoal1Met ? (
                  <Badge
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-600 text-white text-[11px]"
                  >
                    Goal 1 Met ✓
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px]">
                    Incomplete
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <p className="text-muted-foreground leading-relaxed">
                Find a setup delivering near-flagship quality (≥ 95) with serving
                costs at or below $15.00 per 1M tokens. (Hint: Quantizing 70B to
                INT4 drops quality by only 5 points while fitting and drastically
                reducing bandwidth cost).
              </p>
              <div className="flex flex-wrap gap-4 pt-1 font-mono text-[11px]">
                <div className="flex items-center gap-1">
                  <span>Current Quality:</span>
                  <span
                    className={
                      qualityScore >= 95
                        ? "text-emerald-600 dark:text-emerald-400 font-bold"
                        : "text-muted-foreground"
                    }
                  >
                    {qualityScore} {qualityScore >= 95 ? "✓" : "(needs ≥ 95)"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Current Cost:</span>
                  <span
                    className={
                      fits && costPer1MTokens > 0 && costPer1MTokens <= 15
                        ? "text-emerald-600 dark:text-emerald-400 font-bold"
                        : "text-muted-foreground"
                    }
                  >
                    {fits
                      ? `$${costPer1MTokens.toFixed(2)} ${
                          costPer1MTokens <= 15 ? "✓" : "(needs ≤ $15.00)"
                        }`
                      : "Does not fit"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Goal 2 Card */}
          <Card
            className={
              goal2Achieved || isGoal2Met
                ? "border-emerald-500/40 bg-emerald-500/5"
                : ""
            }
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                      goal2Achieved || isGoal2Met
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    2
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    Goal 2: Fastest setup with Quality ≥ 79
                  </CardTitle>
                </div>
                {goal2Achieved || isGoal2Met ? (
                  <Badge
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-600 text-white text-[11px]"
                  >
                    Goal 2 Met ✓
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px]">
                    Incomplete
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <p className="text-muted-foreground leading-relaxed">
                Find the configuration that produces the absolute highest decode
                tokens/s while maintaining an acceptable quality score (≥ 79).
                (Hint: Think small weights across maximum high-bandwidth GPUs).
              </p>
              <div className="flex flex-wrap gap-4 pt-1 font-mono text-[11px]">
                <div className="flex items-center gap-1">
                  <span>Current Quality:</span>
                  <span
                    className={
                      qualityScore >= 79
                        ? "text-emerald-600 dark:text-emerald-400 font-bold"
                        : "text-muted-foreground"
                    }
                  >
                    {qualityScore} {qualityScore >= 79 ? "✓" : "(needs ≥ 79)"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Current Speed:</span>
                  <span
                    className={
                      isGoal2Met
                        ? "text-emerald-600 dark:text-emerald-400 font-bold"
                        : "text-muted-foreground"
                    }
                  >
                    ~{Math.round(tokensPerSecond)} tokens/s{" "}
                    {isGoal2Met ? "✓ (Fastest!)" : "(not fastest setup)"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Interactive controls inside challenge tab for seamless experimentation */}
          <div className="grid gap-4 sm:grid-cols-2 rounded-lg border p-4 bg-muted/20">
            <div className="space-y-2">
              <Label id="level5-challenge-model-label">Model Architecture</Label>
              <ToggleGroup
                id="level5-challenge-model"
                aria-labelledby="level5-challenge-model-label"
                type="single"
                value={modelId}
                onValueChange={(val: string) => {
                  if (val) setModelId(val)
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="llama-3-8b" className="flex-1 text-xs">
                  8B (Llama-3-8B)
                </ToggleGroupItem>
                <ToggleGroupItem value="llama-3-70b" className="flex-1 text-xs">
                  70B (Llama-3-70B)
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <Label id="level5-challenge-precision-label">Weight Precision</Label>
              <ToggleGroup
                id="level5-challenge-precision"
                aria-labelledby="level5-challenge-precision-label"
                type="single"
                value={precision}
                onValueChange={(val: string) => {
                  if (val) setPrecision(val as WeightPrecision)
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="FP16" className="flex-1 text-xs">
                  FP16 (16-bit)
                </ToggleGroupItem>
                <ToggleGroupItem value="FP8" className="flex-1 text-xs">
                  FP8 (8-bit)
                </ToggleGroupItem>
                <ToggleGroupItem value="INT4" className="flex-1 text-xs">
                  INT4 (4-bit)
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <Label id="level5-challenge-gpu-label">GPU Hardware</Label>
              <ToggleGroup
                id="level5-challenge-gpu"
                aria-labelledby="level5-challenge-gpu-label"
                type="single"
                value={gpuId}
                onValueChange={(val: string) => {
                  if (val) setGpuId(val)
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="a100-80gb" className="flex-1 text-xs">
                  A100 (80GB · $2.20/hr)
                </ToggleGroupItem>
                <ToggleGroupItem value="h100-80gb" className="flex-1 text-xs">
                  H100 (80GB · $3.20/hr)
                </ToggleGroupItem>
                <ToggleGroupItem value="l40s-48gb" className="flex-1 text-xs">
                  L40S (48GB · $1.10/hr)
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <Label id="level5-challenge-gpu-count-label">GPU Count</Label>
              <ToggleGroup
                id="level5-challenge-gpu-count"
                aria-labelledby="level5-challenge-gpu-count-label"
                type="single"
                value={String(gpuCount)}
                onValueChange={(val: string) => {
                  if (val) setGpuCount(parseInt(val, 10))
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="1" className="flex-1">
                  1
                </ToggleGroupItem>
                <ToggleGroupItem value="2" className="flex-1">
                  2
                </ToggleGroupItem>
                <ToggleGroupItem value="4" className="flex-1">
                  4
                </ToggleGroupItem>
                <ToggleGroupItem value="8" className="flex-1">
                  8
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {/* Completion Action */}
          <div className="pt-2">
            <Button
              onClick={onComplete}
              disabled={!bothGoalsMet || isCompleted}
              className="gap-2"
              variant={isCompleted ? "secondary" : "default"}
            >
              {isCompleted ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>Level 5 Challenge Completed ✓</span>
                </>
              ) : bothGoalsMet ? (
                <>
                  <Sparkles className="size-4" />
                  <span>Complete Level 5 Challenge</span>
                </>
              ) : (
                <>
                  <Target className="size-4" />
                  <span>Complete Both Goals to Finish</span>
                </>
              )}
            </Button>
          </div>

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
              What you learned in Level 5:
            </p>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Quantization trades a little quality for a lot of speed:</strong> Halving numerical precision (FP16 → FP8 → INT4) cuts memory bandwidth requirements by half or three-quarters, directly speeding up decode token generation.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Bigger-but-quantized often beats smaller-but-full-precision:</strong> A 70B model quantized to INT4 (quality 95) delivers substantially higher intelligence than an 8B model at FP16 (quality 80), while easily fitting on a single 48GB or 80GB GPU.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Always verify quality on your specific domain:</strong> Toy benchmark tables provide conceptual heuristics, but true quantization degradation varies with task difficulty, domain knowledge, and prompt length.
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
            <Badge variant="outline" className="text-xs">
              Level 5 Completed
            </Badge>
          </div>
        </div>
      </LevelSectionContent>
    </div>
  )
}
