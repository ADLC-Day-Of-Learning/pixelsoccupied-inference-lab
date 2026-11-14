import * as React from "react"
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  HardDrive,
  Play,
  RotateCcw,
  Sparkles,
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
  BYTES_IN_GB,
  calculateWeightMemory,
  estimateDecodeStepTime,
  estimateRequestLatency,
  GPU_PRESETS,
  MODEL_PRESETS,
} from "@/lib/model"

export function Level2Component({ onComplete }: LevelProps) {
  const { setActiveSection, isCompleted } = useLevelLayout()

  // --- Try Section Interactive State ---
  const [modelId, setModelId] = React.useState<string>("llama-3-8b")
  const [gpuId, setGpuId] = React.useState<string>("a100-80gb")
  const [promptTokens, setPromptTokens] = React.useState<number>(1024)
  const [outputTokens, setOutputTokens] = React.useState<number>(256)
  const [isSimulating, setIsSimulating] = React.useState<boolean>(false)

  // --- Challenge Section Interactive State ---
  const [challengeModelId, setChallengeModelId] = React.useState<string>("llama-3-8b")
  const [challengeGpuId, setChallengeGpuId] = React.useState<string>("a100-80gb")
  const [challengePromptTokens, setChallengePromptTokens] = React.useState<number>(4000)
  const [challengeOutputTokens, setChallengeOutputTokens] = React.useState<number>(10)

  // Track independent goal satisfaction so user can solve them in stages
  const [goal1Achieved, setGoal1Achieved] = React.useState<boolean>(false)
  const [goal2Achieved, setGoal2Achieved] = React.useState<boolean>(false)

  // Resolve presets for Try view
  const activeModel =
    MODEL_PRESETS.find((m) => m.id === modelId) ?? MODEL_PRESETS[0]
  const activeGpu =
    GPU_PRESETS.find((g) => g.id === gpuId) ?? GPU_PRESETS[0]

  // Pure latency calculation for Try view
  const tryLatency = estimateRequestLatency({
    parameters: activeModel.parameters,
    promptTokens,
    outputTokens,
    peakTflops: activeGpu.peakTflops,
    memoryBandwidthTb: activeGpu.memoryBandwidthTb,
    layers: activeModel.layers,
    kvHeads: activeModel.kvHeads,
    headDim: activeModel.headDim,
    weightPrecision: "FP16",
    kvPrecision: "FP16",
  })

  // Ideal weight streaming calculation for Key Intuition (ignoring KV & overhead)
  const weightBytes = calculateWeightMemory(activeModel.parameters, "FP16")
  const weightGb = weightBytes / BYTES_IN_GB
  const idealDecodeMs =
    estimateDecodeStepTime({
      weightBytes,
      kvBytesRead: 0,
      memoryBandwidthTb: activeGpu.memoryBandwidthTb,
      bandwidthUtilization: 1,
    }) * 1000

  // Side-by-side comparison workloads: Short Chat vs Long Summarization
  const shortChatLatency = estimateRequestLatency({
    parameters: activeModel.parameters,
    promptTokens: 200,
    outputTokens: 500,
    peakTflops: activeGpu.peakTflops,
    memoryBandwidthTb: activeGpu.memoryBandwidthTb,
    layers: activeModel.layers,
    kvHeads: activeModel.kvHeads,
    headDim: activeModel.headDim,
  })

  const longSummarizationLatency = estimateRequestLatency({
    parameters: activeModel.parameters,
    promptTokens: 4000,
    outputTokens: 200,
    peakTflops: activeGpu.peakTflops,
    memoryBandwidthTb: activeGpu.memoryBandwidthTb,
    layers: activeModel.layers,
    kvHeads: activeModel.kvHeads,
    headDim: activeModel.headDim,
  })

  // Resolve presets and calculations for Challenge view
  const challengeModel =
    MODEL_PRESETS.find((m) => m.id === challengeModelId) ?? MODEL_PRESETS[0]
  const challengeGpu =
    GPU_PRESETS.find((g) => g.id === challengeGpuId) ?? GPU_PRESETS[0]

  const challengeLatency = estimateRequestLatency({
    parameters: challengeModel.parameters,
    promptTokens: challengePromptTokens,
    outputTokens: challengeOutputTokens,
    peakTflops: challengeGpu.peakTflops,
    memoryBandwidthTb: challengeGpu.memoryBandwidthTb,
    layers: challengeModel.layers,
    kvHeads: challengeModel.kvHeads,
    headDim: challengeModel.headDim,
  })

  // Goal evaluation
  // Goal 1: TTFT < 200 ms for a 4K-token prompt (prompt tokens >= 4000)
  const currentGoal1Condition =
    challengePromptTokens >= 4000 && challengeLatency.prefillMs < 200

  // Goal 2: Decode dominates total time (totalDecodeMs > prefillMs)
  const currentGoal2Condition = challengeLatency.isDecodeDominant

  React.useEffect(() => {
    if (currentGoal1Condition) {
      setGoal1Achieved(true)
    }
  }, [currentGoal1Condition])

  React.useEffect(() => {
    if (currentGoal2Condition) {
      setGoal2Achieved(true)
    }
  }, [currentGoal2Condition])

  const bothGoalsMet = goal1Achieved && goal2Achieved

  React.useEffect(() => {
    if (!isSimulating) return
    const timeout = setTimeout(() => {
      setIsSimulating(false)
    }, 1800)
    return () => clearTimeout(timeout)
  }, [isSimulating])

  // Simulation playback trigger
  const handleSimulate = () => {
    setIsSimulating(true)
  }

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. LEARN SECTION */}
      {/* ========================================================================= */}
      <LevelSectionContent section="learn">
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight">
              Prefill vs. Decode: Two Distinct Systems Regimes
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Serving an LLM request happens in two completely different physical
              phases. Knowing which phase dominates your workload dictates whether
              you need more raw compute (FLOPs) or more memory bandwidth (TB/s).
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="bg-muted/30 border-blue-500/20">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Cpu className="size-4" />
                  </div>
                  <CardTitle className="text-sm">Phase 1: Prefill (TTFT)</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-1.5">
                <p>
                  <strong>Compute-bound.</strong> Processes all prompt tokens at
                  once in parallel. Time-to-first-token (TTFT) scales with{" "}
                  <code>2 × parameters × prompt tokens</code>.
                </p>
                <p className="text-primary/90 font-medium">
                  Bottleneck: GPU Tensor Core compute (peak TFLOPS).
                </p>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 border-emerald-500/20">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <HardDrive className="size-4" />
                  </div>
                  <CardTitle className="text-sm">Phase 2: Decode (Latency)</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-1.5">
                <p>
                  <strong>Memory-bandwidth-bound.</strong> Generates tokens one by
                  one auto-regressively. Each token step must stream{" "}
                  <strong>all model weights</strong> from VRAM.
                </p>
                <p className="text-primary/90 font-medium">
                  Bottleneck: GPU memory bandwidth (TB/s), not FLOPs.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Two-phase Timeline Diagram */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Request Execution Timeline
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
                  <span className="size-2 rounded-full bg-blue-500" />
                  Phase 1: Wide Prefill Block (TTFT)
                </span>
                <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Phase 2: Sequence of Decode Ticks (One per Token)
                </span>
              </div>

              {/* Inline SVG Diagram */}
              <div className="w-full overflow-hidden rounded-md border bg-muted/40 p-2">
                <svg
                  viewBox="0 0 700 80"
                  className="w-full h-auto"
                  aria-label="Two-phase timeline diagram showing wide prefill block followed by thin decode ticks"
                  role="img"
                >
                  {/* Prefill Block */}
                  <rect
                    x="10"
                    y="15"
                    width="190"
                    height="50"
                    rx="6"
                    className="fill-blue-500/20 stroke-blue-500 stroke-2"
                  />
                  <text
                    x="105"
                    y="38"
                    textAnchor="middle"
                    className="fill-blue-900 dark:fill-blue-200 text-xs font-bold font-sans"
                  >
                    PREFILL (All prompt tokens)
                  </text>
                  <text
                    x="105"
                    y="54"
                    textAnchor="middle"
                    className="fill-blue-700 dark:fill-blue-300 text-[10px] font-sans"
                  >
                    Compute-bound (FLOPs) → TTFT
                  </text>

                  {/* Arrow to decode */}
                  <path
                    d="M 205 40 L 215 40"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="text-muted-foreground"
                  />

                  {/* Decode Ticks */}
                  {[
                    225, 255, 285, 315, 345, 375, 405, 435, 465, 495, 525, 555,
                    585, 615, 645, 675,
                  ].map((x, idx) => (
                    <g key={x}>
                      <rect
                        x={x}
                        y="15"
                        width="18"
                        height="50"
                        rx="3"
                        className="fill-emerald-500/20 stroke-emerald-500 stroke-1.5"
                      />
                      <line
                        x1={x + 9}
                        y1="22"
                        x2={x + 9}
                        y2="58"
                        className="stroke-emerald-600 dark:stroke-emerald-400 stroke-1"
                      />
                      {idx === 0 && (
                        <text
                          x={x + 9}
                          y="10"
                          textAnchor="middle"
                          className="fill-emerald-700 dark:fill-emerald-300 text-[9px] font-mono"
                        >
                          Tok 1
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
              </div>

              <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1">
                <span>Prompt in → Computation finishes → TTFT</span>
                <span>Each tick reads 100% of weights to emit next token</span>
              </div>
            </div>
          </div>

          {/* Key Intuition Arithmetic Callout */}
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4 pb-4 space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-amber-600 dark:text-amber-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  The Key Intuition: Why Decode Speed is Memory-Bound
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Because decode produces tokens one by one, every forward pass
                must read the entire model weight matrix from GPU VRAM:
              </p>
              <div className="rounded-md bg-background/80 p-2.5 font-mono text-xs border text-foreground">
                <span className="text-muted-foreground">Decode Step Latency</span> ≈{" "}
                <span className="font-semibold text-primary">Model Weight Bytes</span> ÷{" "}
                <span className="font-semibold text-primary">Memory Bandwidth</span>
                <div className="text-[11px] text-muted-foreground mt-1">
                  e.g., 16 GB weights ÷ 2.0 TB/s (A100) ≈{" "}
                  <strong className="text-foreground">8.0 ms per token</strong>{" "}
                  (minimum theoretical step time)
                </div>
              </div>
            </CardContent>
          </Card>

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

      {/* ========================================================================= */}
      {/* 2. TRY SECTION */}
      {/* ========================================================================= */}
      <LevelSectionContent section="try">
        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">
              Interactive Latency Sandbox
            </h3>
            <p className="text-muted-foreground text-sm">
              Adjust model size, GPU architecture, prompt length, and output tokens
              to see how prefill (TTFT) and decode latency respond.
            </p>
          </div>

          {/* Controls Grid */}
          <div className="grid gap-4 sm:grid-cols-2 rounded-lg border p-4 bg-muted/20">
            {/* Model Architecture Compound Control */}
            <div className="space-y-1.5">
              <Label id="try-model-label" htmlFor="try-model-group">
                Model Architecture
              </Label>
              <ToggleGroup
                id="try-model-group"
                aria-labelledby="try-model-label"
                type="single"
                value={modelId}
                onValueChange={(val: string) => {
                  if (val) setModelId(val)
                }}
                variant="outline"
                className="w-full flex"
              >
                <ToggleGroupItem value="llama-3-8b" className="flex-1">
                  Llama-3-8B (8B)
                </ToggleGroupItem>
                <ToggleGroupItem value="llama-3-70b" className="flex-1">
                  Llama-3-70B (70B)
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* GPU Hardware Compound Control */}
            <div className="space-y-1.5">
              <Label id="try-gpu-label" htmlFor="try-gpu-group">
                GPU Hardware
              </Label>
              <ToggleGroup
                id="try-gpu-group"
                aria-labelledby="try-gpu-label"
                type="single"
                value={gpuId}
                onValueChange={(val: string) => {
                  if (val) setGpuId(val)
                }}
                variant="outline"
                className="w-full flex"
              >
                <ToggleGroupItem value="a100-80gb" className="flex-1">
                  A100 (2.0 TB/s)
                </ToggleGroupItem>
                <ToggleGroupItem value="h100-80gb" className="flex-1">
                  H100 (3.35 TB/s)
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Prompt Length Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Label htmlFor="try-prompt-slider" className="font-medium">
                  Prompt Length:
                </Label>
                <span className="font-mono text-xs font-semibold text-primary">
                  {promptTokens.toLocaleString()} tokens
                </span>
              </div>
              <input
                id="try-prompt-slider"
                type="range"
                min={100}
                max={32000}
                step={100}
                value={promptTokens}
                onChange={(e) => setPromptTokens(Number(e.target.value))}
                className="w-full cursor-pointer"
                aria-label="Prompt length tokens"
              />
              <div className="flex gap-1.5">
                {[
                  { label: "Chat (200)", val: 200 },
                  { label: "1K", val: 1024 },
                  { label: "4K", val: 4000 },
                  { label: "32K", val: 32000 },
                ].map((p) => (
                  <Button
                    key={p.val}
                    type="button"
                    variant={promptTokens === p.val ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => setPromptTokens(p.val)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Output Length Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Label htmlFor="try-output-slider" className="font-medium">
                  Output Length:
                </Label>
                <span className="font-mono text-xs font-semibold text-primary">
                  {outputTokens.toLocaleString()} tokens
                </span>
              </div>
              <input
                id="try-output-slider"
                type="range"
                min={10}
                max={1000}
                step={10}
                value={outputTokens}
                onChange={(e) => setOutputTokens(Number(e.target.value))}
                className="w-full cursor-pointer"
                aria-label="Output length tokens"
              />
              <div className="flex gap-1.5">
                {[
                  { label: "Short (50)", val: 50 },
                  { label: "Med (256)", val: 256 },
                  { label: "Long (1K)", val: 1000 },
                ].map((p) => (
                  <Button
                    key={p.val}
                    type="button"
                    variant={outputTokens === p.val ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => setOutputTokens(p.val)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Real-time Metric Cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="bg-card">
              <CardContent className="pt-4 pb-4 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>TTFT (Prefill)</span>
                  <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400">
                    Compute
                  </Badge>
                </div>
                <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                  {tryLatency.prefillMs < 1000
                    ? `${tryLatency.prefillMs.toFixed(0)} ms`
                    : `${tryLatency.prefillSeconds.toFixed(2)} s`}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Time until first token begins streaming.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="pt-4 pb-4 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Inter-Token Latency</span>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    Bandwidth
                  </Badge>
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {tryLatency.decodeStepMs.toFixed(1)} ms
                </div>
                <p className="text-[11px] text-muted-foreground">
                  ~{Math.round(tryLatency.decodeTokensPerSecond)} tokens/s per request.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="pt-4 pb-4 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Total Time</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {tryLatency.isDecodeDominant ? "Decode Dominated" : "Prefill Dominated"}
                  </Badge>
                </div>
                <div className="text-2xl font-bold font-mono text-primary">
                  {tryLatency.totalSeconds.toFixed(2)} s
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Prefill {tryLatency.prefillPercentage.toFixed(0)}% · Decode{" "}
                  {tryLatency.decodePercentage.toFixed(0)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Animated Request Timeline Bar */}
          <div className="space-y-3 rounded-lg border p-4 bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <h4 className="text-sm font-semibold">Request Latency Timeline</h4>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSimulate}
                disabled={isSimulating}
                className="gap-1.5 h-7 text-xs"
              >
                <Play className="size-3" />
                <span>{isSimulating ? "Simulating..." : "Simulate Timeline"}</span>
              </Button>
            </div>

            {/* Stacked Proportional Bar */}
            <div className="relative h-8 w-full overflow-hidden rounded-md bg-muted/50 border flex">
              {/* Prefill segment */}
              <div
                style={{ width: `${Math.max(2, tryLatency.prefillPercentage)}%` }}
                className="h-full bg-blue-500 text-white text-[11px] font-medium flex items-center justify-center px-1.5 transition-all duration-300 relative truncate"
                title={`Prefill: ${tryLatency.prefillMs.toFixed(0)} ms (${tryLatency.prefillPercentage.toFixed(1)}%)`}
              >
                {tryLatency.prefillPercentage > 12 && (
                  <span className="truncate">
                    Prefill {tryLatency.prefillMs.toFixed(0)} ms
                  </span>
                )}
              </div>

              {/* Decode segment */}
              <div
                style={{ width: `${Math.max(2, tryLatency.decodePercentage)}%` }}
                className="h-full bg-emerald-500 text-white text-[11px] font-medium flex items-center justify-center px-1.5 transition-all duration-300 relative truncate"
                title={`Decode: ${tryLatency.totalDecodeMs.toFixed(0)} ms (${tryLatency.decodePercentage.toFixed(1)}%)`}
              >
                {tryLatency.decodePercentage > 12 && (
                  <span className="truncate">
                    Decode {tryLatency.totalDecodeMs.toFixed(0)} ms ({outputTokens} tok)
                  </span>
                )}
              </div>

              {/* Simulated playback cursor */}
              {isSimulating && (
                <div
                  className="absolute inset-y-0 w-1 bg-white shadow-md animate-in slide-in-from-left duration-1500"
                  style={{ animationDuration: "1.8s" }}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-blue-500" />
                <span>
                  Prefill: <strong>{tryLatency.prefillMs.toFixed(0)} ms</strong> (
                  {tryLatency.prefillPercentage.toFixed(1)}%)
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                <span>
                  Decode: <strong>{tryLatency.totalDecodeMs.toFixed(0)} ms</strong> (
                  {tryLatency.decodePercentage.toFixed(1)}%)
                </span>
              </span>
              <span>
                Total: <strong>{tryLatency.totalSeconds.toFixed(2)} s</strong>
              </span>
            </div>
          </div>

          {/* Show the Formula / Math in Action */}
          <div className="rounded-lg border bg-muted/10 p-4 space-y-2.5 text-xs text-muted-foreground">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
              Formulas Plugged In for Current Selection
            </div>
            <div className="grid gap-2 sm:grid-cols-2 font-mono text-[11px]">
              <div className="p-2.5 rounded border bg-background/50 space-y-1">
                <div className="text-blue-600 dark:text-blue-400 font-semibold">
                  Prefill Formula (Compute-bound)
                </div>
                <div>
                  TTFT = (2 × {activeModel.parametersBillions}B × {promptTokens}) ÷ ({activeGpu.peakTflops} TFLOPS × 50%)
                </div>
                <div className="text-foreground font-bold">
                  ≈ {tryLatency.prefillMs.toFixed(1)} ms
                </div>
              </div>
              <div className="p-2.5 rounded border bg-background/50 space-y-1">
                <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Decode Formula (Bandwidth-bound)
                </div>
                <div>
                  Step = ({weightGb.toFixed(1)} GB weights + KV) ÷ ({activeGpu.memoryBandwidthTb} TB/s × 70%)
                </div>
                <div className="text-foreground font-bold">
                  ≈ {tryLatency.decodeStepMs.toFixed(1)} ms/token ({idealDecodeMs.toFixed(1)} ms raw weight stream)
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-Side Comparison: Short Chat vs Long Summarization */}
          <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">
                Side-by-Side: Why Long Prompts Hurt TTFT
              </h4>
              <p className="text-xs text-muted-foreground">
                Compare a short interactive chat request vs. a long document
                summarization request on the same {activeGpu.name} hardware:
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Short Chat Request */}
              <div className="rounded-md border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">Short Chat</span>
                  <Badge variant="outline" className="text-[10px]">
                    200 in / 500 out
                  </Badge>
                </div>
                <div className="h-5 w-full overflow-hidden rounded bg-muted flex text-[10px]">
                  <div
                    style={{ width: `${Math.max(3, shortChatLatency.prefillPercentage)}%` }}
                    className="bg-blue-500 h-full"
                    title={`Prefill: ${shortChatLatency.prefillMs.toFixed(0)} ms`}
                  />
                  <div
                    style={{ width: `${Math.max(3, shortChatLatency.decodePercentage)}%` }}
                    className="bg-emerald-500 h-full"
                    title={`Decode: ${shortChatLatency.totalDecodeMs.toFixed(0)} ms`}
                  />
                </div>
                <div className="text-[11px] text-muted-foreground flex justify-between">
                  <span>
                    TTFT: <strong className="text-foreground">{shortChatLatency.prefillMs.toFixed(0)} ms</strong>
                  </span>
                  <span>
                    Total: <strong className="text-foreground">{shortChatLatency.totalSeconds.toFixed(2)} s</strong>
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Instant response: decode dominates {shortChatLatency.decodePercentage.toFixed(0)}% of time.
                </p>
              </div>

              {/* Long Summarization Request */}
              <div className="rounded-md border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">Long Summarization</span>
                  <Badge variant="outline" className="text-[10px]">
                    4,000 in / 200 out
                  </Badge>
                </div>
                <div className="h-5 w-full overflow-hidden rounded bg-muted flex text-[10px]">
                  <div
                    style={{ width: `${Math.max(3, longSummarizationLatency.prefillPercentage)}%` }}
                    className="bg-blue-500 h-full"
                    title={`Prefill: ${longSummarizationLatency.prefillMs.toFixed(0)} ms`}
                  />
                  <div
                    style={{ width: `${Math.max(3, longSummarizationLatency.decodePercentage)}%` }}
                    className="bg-emerald-500 h-full"
                    title={`Decode: ${longSummarizationLatency.totalDecodeMs.toFixed(0)} ms`}
                  />
                </div>
                <div className="text-[11px] text-muted-foreground flex justify-between">
                  <span>
                    TTFT: <strong className="text-foreground">{longSummarizationLatency.prefillMs.toFixed(0)} ms</strong>
                  </span>
                  <span>
                    Total: <strong className="text-foreground">{longSummarizationLatency.totalSeconds.toFixed(2)} s</strong>
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  High prompt compute delay: prefill is {longSummarizationLatency.prefillPercentage.toFixed(0)}% of total.
                </p>
              </div>
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

      {/* ========================================================================= */}
      {/* 3. CHALLENGE SECTION */}
      {/* ========================================================================= */}
      <LevelSectionContent section="challenge">
        <div className="space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight">
                Level 2 Challenge: Master Compute & Bandwidth Tradeoffs
              </h3>
              {isCompleted ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
                  Completed ✓
                </Badge>
              ) : bothGoalsMet ? (
                <Badge className="bg-emerald-600 text-white">Goals Met ✓</Badge>
              ) : (
                <Badge variant="secondary">In Progress</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Demonstrate that you can control TTFT and decode dominance by
              configuring the right hardware and prompt parameters for two distinct goals.
            </p>
          </div>

          {/* Interactive Challenge Controls */}
          <div className="grid gap-3 sm:grid-cols-2 rounded-lg border p-4 bg-muted/20">
            {/* Challenge Model Compound Control */}
            <div className="space-y-1.5">
              <Label id="challenge-model-label" htmlFor="challenge-model-group">
                Model
              </Label>
              <ToggleGroup
                id="challenge-model-group"
                aria-labelledby="challenge-model-label"
                type="single"
                value={challengeModelId}
                onValueChange={(val: string) => {
                  if (val) setChallengeModelId(val)
                }}
                variant="outline"
                className="w-full flex"
              >
                <ToggleGroupItem value="llama-3-8b" className="flex-1">
                  8B
                </ToggleGroupItem>
                <ToggleGroupItem value="llama-3-70b" className="flex-1">
                  70B
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Challenge GPU Compound Control */}
            <div className="space-y-1.5">
              <Label id="challenge-gpu-label" htmlFor="challenge-gpu-group">
                GPU Hardware
              </Label>
              <ToggleGroup
                id="challenge-gpu-group"
                aria-labelledby="challenge-gpu-label"
                type="single"
                value={challengeGpuId}
                onValueChange={(val: string) => {
                  if (val) setChallengeGpuId(val)
                }}
                variant="outline"
                className="w-full flex"
              >
                <ToggleGroupItem value="a100-80gb" className="flex-1">
                  A100 (312 TFLOPS)
                </ToggleGroupItem>
                <ToggleGroupItem value="h100-80gb" className="flex-1">
                  H100 (989 TFLOPS)
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Challenge Prompt Tokens */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <Label htmlFor="challenge-prompt-input" className="font-medium">
                  Prompt Tokens:
                </Label>
                <span className="font-mono font-semibold text-primary">
                  {challengePromptTokens}
                </span>
              </div>
              <input
                id="challenge-prompt-input"
                type="range"
                min={100}
                max={8000}
                step={100}
                value={challengePromptTokens}
                onChange={(e) => setChallengePromptTokens(Number(e.target.value))}
                className="w-full cursor-pointer"
                aria-label="Challenge prompt tokens"
              />
              <div className="flex gap-1">
                {[200, 1000, 4000].map((num) => (
                  <Button
                    key={num}
                    type="button"
                    size="sm"
                    variant={challengePromptTokens === num ? "default" : "outline"}
                    className="h-5 text-[10px] px-1.5"
                    onClick={() => setChallengePromptTokens(num)}
                    aria-label={`${num} tok (Prompt)`}
                  >
                    {num} tok
                  </Button>
                ))}
              </div>
            </div>

            {/* Challenge Output Tokens */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <Label htmlFor="challenge-output-input" className="font-medium">
                  Output Tokens:
                </Label>
                <span className="font-mono font-semibold text-primary">
                  {challengeOutputTokens}
                </span>
              </div>
              <input
                id="challenge-output-input"
                type="range"
                min={10}
                max={1000}
                step={10}
                value={challengeOutputTokens}
                onChange={(e) => setChallengeOutputTokens(Number(e.target.value))}
                className="w-full cursor-pointer"
                aria-label="Challenge output tokens"
              />
              <div className="flex gap-1">
                {[50, 200, 500].map((num) => (
                  <Button
                    key={num}
                    type="button"
                    size="sm"
                    variant={challengeOutputTokens === num ? "default" : "outline"}
                    className="h-5 text-[10px] px-1.5"
                    onClick={() => setChallengeOutputTokens(num)}
                    aria-label={`${num} tok (Output)`}
                  >
                    {num} tok
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Goal 1 and Goal 2 Status Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Goal 1 Card */}
            <Card
              className={
                goal1Achieved
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-muted"
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex size-6 items-center justify-center rounded-full ${
                        goal1Achieved
                          ? "bg-emerald-600 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {goal1Achieved ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <Target className="size-3.5" />
                      )}
                    </div>
                    <CardTitle className="text-sm">Goal 1: Fast 4K TTFT</CardTitle>
                  </div>
                  <Badge
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    variant={goal1Achieved ? "default" : "secondary"}
                    className={goal1Achieved ? "bg-emerald-600 text-white text-[10px]" : "text-[10px]"}
                  >
                    {goal1Achieved ? "Passed ✓" : "In Progress"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <p className="text-muted-foreground leading-relaxed">
                  <strong>Requirement:</strong> Get TTFT under 200 ms for a
                  4K-token prompt (prompt ≥ 4,000 tokens).
                </p>
                <div className="rounded-md bg-muted/40 p-2 font-mono text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span>Current Prompt:</span>
                    <span className={challengePromptTokens >= 4000 ? "text-emerald-600 font-bold" : "text-amber-600"}>
                      {challengePromptTokens} tokens {challengePromptTokens >= 4000 ? "✓" : "(need ≥ 4000)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current TTFT:</span>
                    <span className={challengeLatency.prefillMs < 200 ? "text-emerald-600 font-bold" : "text-amber-600"}>
                      {challengeLatency.prefillMs.toFixed(0)} ms {challengeLatency.prefillMs < 200 ? "✓" : "(need < 200 ms)"}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground italic">
                  Hint: Prefill is compute-bound. Switch to H100 with higher peak TFLOPS.
                </p>
              </CardContent>
            </Card>

            {/* Goal 2 Card */}
            <Card
              className={
                goal2Achieved
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-muted"
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex size-6 items-center justify-center rounded-full ${
                        goal2Achieved
                          ? "bg-emerald-600 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {goal2Achieved ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <Target className="size-3.5" />
                      )}
                    </div>
                    <CardTitle className="text-sm">Goal 2: Decode Dominance</CardTitle>
                  </div>
                  <Badge
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    variant={goal2Achieved ? "default" : "secondary"}
                    className={goal2Achieved ? "bg-emerald-600 text-white text-[10px]" : "text-[10px]"}
                  >
                    {goal2Achieved ? "Passed ✓" : "In Progress"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <p className="text-muted-foreground leading-relaxed">
                  <strong>Requirement:</strong> Find a setup where decode, not
                  prefill, dominates total time (Decode time &gt; Prefill time).
                </p>
                <div className="rounded-md bg-muted/40 p-2 font-mono text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span>Decode Share:</span>
                    <span className={challengeLatency.isDecodeDominant ? "text-emerald-600 font-bold" : "text-amber-600"}>
                      {challengeLatency.decodePercentage.toFixed(0)}% {challengeLatency.isDecodeDominant ? "(Dominates ✓)" : "(≤ 50%)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Prefill vs Decode:</span>
                    <span>
                      {challengeLatency.prefillMs.toFixed(0)} ms prefill vs {challengeLatency.totalDecodeMs.toFixed(0)} ms decode
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground italic">
                  Hint: Set a shorter prompt and longer output length.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Completion Action Card */}
          <Card className={bothGoalsMet || isCompleted ? "border-emerald-500/40 bg-emerald-500/5" : ""}>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    isCompleted || bothGoalsMet
                      ? "bg-emerald-600 text-white"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {isCompleted || bothGoalsMet ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <Target className="size-5" />
                  )}
                </div>
                <div className="space-y-1" role="status" aria-live="polite" aria-atomic="true">
                  <h4 className="text-sm font-semibold">
                    {isCompleted
                      ? "Challenge Complete!"
                      : bothGoalsMet
                        ? "Both Goals Solved! Ready to Complete"
                        : "Complete Both Goals to Pass"}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isCompleted
                      ? "You have completed Level 2 and mastered prefill vs decode tradeoffs."
                      : bothGoalsMet
                        ? "You met both challenge criteria! Click the button below to record your progress."
                        : "Experiment with the controls above to satisfy Goal 1 (TTFT < 200 ms at 4K) and Goal 2 (Decode > Prefill)."}
                  </p>
                </div>
              </div>

              <div className="pt-1 flex items-center gap-3">
                <Button
                  onClick={onComplete}
                  disabled={!bothGoalsMet || isCompleted}
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
                      <span>Complete Level 2 Challenge</span>
                    </>
                  )}
                </Button>

                {bothGoalsMet && !isCompleted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground gap-1"
                    onClick={() => {
                      setGoal1Achieved(false)
                      setGoal2Achieved(false)
                    }}
                  >
                    <RotateCcw className="size-3" />
                    <span>Reset Goals</span>
                  </Button>
                )}
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

      {/* ========================================================================= */}
      {/* 4. RECAP SECTION */}
      {/* ========================================================================= */}
      <LevelSectionContent section="recap">
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">Key Takeaways</h3>
            <p className="text-muted-foreground text-sm">
              Here is what you learned in Level 2 about prefill vs. decode:
            </p>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Long prompts → slow first token (TTFT):</strong> Prefill
                is compute-bound because all prompt tokens are processed in
                parallel across GPU Tensor Cores. Faster compute (TFLOPS) reduces TTFT.
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Long outputs → total time dominated by decode:</strong>{" "}
                Decode generates tokens sequentially. Every single step must stream
                all model weights from memory. Higher memory bandwidth (TB/s) speeds
                up token generation.
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Workload dictates the system bottleneck:</strong> RAG and
                long-context document queries stress prefill compute, while code
                generation and creative writing stress decode memory bandwidth.
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
                Ready for Level 3
              </Badge>
            </div>
          </div>
        </div>
      </LevelSectionContent>
    </div>
  )
}
