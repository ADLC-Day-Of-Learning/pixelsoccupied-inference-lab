import * as React from "react"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers,
  Server,
  Sparkles,
  Target,
  Users,
  XCircle,
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
  calculateKvCachePerToken,
  calculateKvPreemption,
  MODEL_PRESETS,
  GPU_PRESETS,
  BYTES_IN_GB,
  BYTES_IN_KB,
  type KvPrecision,
  type WeightPrecision,
} from "@/lib/model"

const KV_OVERHEAD_FRACTION = 0.05 // 5% runtime overhead for CUDA activations and framework buffers

const CONTEXT_OPTIONS = [
  { label: "1K", tokens: 1024 },
  { label: "2K", tokens: 2048 },
  { label: "4K", tokens: 4096 },
  { label: "8K", tokens: 8192 },
  { label: "16K", tokens: 16384 },
  { label: "32K", tokens: 32768 },
  { label: "64K", tokens: 65536 },
  { label: "128K", tokens: 131072 },
]

const CONCURRENCY_PRESETS = [1, 8, 16, 32, 64, 128, 256]

export function Level3Component({ onComplete }: LevelProps) {
  const { setActiveSection, isCompleted } = useLevelLayout()

  // ---------------------------------------------------------------------------
  // TRY SECTION STATE
  // ---------------------------------------------------------------------------
  const [modelId, setModelId] = React.useState<string>("llama-3-8b")
  const [gpuId, setGpuId] = React.useState<string>("a100-80gb")
  const [gpuCount, setGpuCount] = React.useState<number>(1)
  const [kvPrecision, setKvPrecision] = React.useState<KvPrecision>("FP16")
  const [contextLength, setContextLength] = React.useState<number>(8192)
  const [concurrentRequests, setConcurrentRequests] = React.useState<number>(32)

  const activeModel =
    MODEL_PRESETS.find((m) => m.id === modelId) ?? MODEL_PRESETS[0]
  const activeGpu =
    GPU_PRESETS.find((g) => g.id === gpuId) ?? GPU_PRESETS[0]

  const weightPrecision: WeightPrecision = "FP16"
  const weightMemoryBytes = calculateWeightMemory(
    activeModel.parameters,
    weightPrecision
  )
  const weightMemoryGb = weightMemoryBytes / BYTES_IN_GB

  const totalGpuMemoryBytes = activeGpu.memoryGb * gpuCount * BYTES_IN_GB
  const totalGpuMemoryGb = activeGpu.memoryGb * gpuCount

  const overheadBytes = totalGpuMemoryBytes * KV_OVERHEAD_FRACTION
  const overheadGb = overheadBytes / BYTES_IN_GB

  const kvPerTokenBytes = calculateKvCachePerToken(
    activeModel.layers,
    activeModel.kvHeads,
    activeModel.headDim,
    kvPrecision
  )
  const kvPerTokenKb = kvPerTokenBytes / BYTES_IN_KB

  const simulation = calculateKvPreemption({
    totalGpuMemoryBytes,
    weightMemoryBytes,
    overheadBytes,
    kvPerTokenBytes,
    concurrentRequests,
    contextLengthTokens: contextLength,
  })

  // Gauge segment percentages
  const weightsPercent = Math.min(
    100,
    (weightMemoryBytes / totalGpuMemoryBytes) * 100
  )
  const overheadPercent = Math.min(
    100 - weightsPercent,
    (overheadBytes / totalGpuMemoryBytes) * 100
  )
  const kvInUsePercent = Math.min(
    Math.max(0, 100 - weightsPercent - overheadPercent),
    (simulation.kvInUseBytes / totalGpuMemoryBytes) * 100
  )
  const freeRemainingPercent = Math.max(
    0,
    100 - weightsPercent - overheadPercent - kvInUsePercent
  )
  const freeRemainingGb = Math.max(
    0,
    simulation.freeMemoryGb - simulation.kvInUseGb
  )

  // ---------------------------------------------------------------------------
  // CHALLENGE SECTION STATE
  // ---------------------------------------------------------------------------
  // Goal 1: Serve 32 concurrent users at 8K context on Llama-3-8B without preemption, using 1 GPU.
  const [goal1GpuId, setGoal1GpuId] = React.useState<string>("l40s-48gb")
  const [goal1KvPrecision, setGoal1KvPrecision] =
    React.useState<KvPrecision>("FP16")

  const goal1Model = MODEL_PRESETS[0] // Llama-3-8B
  const goal1Gpu =
    GPU_PRESETS.find((g) => g.id === goal1GpuId) ?? GPU_PRESETS[0]
  const goal1TotalMemoryBytes = goal1Gpu.memoryGb * 1 * BYTES_IN_GB
  const goal1WeightsBytes = calculateWeightMemory(
    goal1Model.parameters,
    "FP16"
  )
  const goal1OverheadBytes = goal1TotalMemoryBytes * KV_OVERHEAD_FRACTION
  const goal1KvPerTokenBytes = calculateKvCachePerToken(
    goal1Model.layers,
    goal1Model.kvHeads,
    goal1Model.headDim,
    goal1KvPrecision
  )

  const goal1Sim = calculateKvPreemption({
    totalGpuMemoryBytes: goal1TotalMemoryBytes,
    weightMemoryBytes: goal1WeightsBytes,
    overheadBytes: goal1OverheadBytes,
    kvPerTokenBytes: goal1KvPerTokenBytes,
    concurrentRequests: 32,
    contextLengthTokens: 8192,
  })

  const goal1Passed =
    goal1Sim.preemptedRequests === 0 && goal1Sim.servedRequests === 32

  // Goal 2: Llama-3-70B: serve 16 users at 4K context with the fewest GPUs (also try FP8 KV cache).
  const [goal2GpuId, setGoal2GpuId] = React.useState<string>("a100-80gb")
  const [goal2GpuCount, setGoal2GpuCount] = React.useState<number>(2)
  const [goal2KvPrecision, setGoal2KvPrecision] =
    React.useState<KvPrecision>("FP16")

  const goal2Model = MODEL_PRESETS[1] // Llama-3-70B
  const goal2Gpu =
    GPU_PRESETS.find((g) => g.id === goal2GpuId) ?? GPU_PRESETS[0]
  const goal2TotalMemoryBytes = goal2Gpu.memoryGb * goal2GpuCount * BYTES_IN_GB
  const goal2WeightsBytes = calculateWeightMemory(
    goal2Model.parameters,
    "FP16"
  )
  const goal2OverheadBytes = goal2TotalMemoryBytes * KV_OVERHEAD_FRACTION
  const goal2KvPerTokenBytes = calculateKvCachePerToken(
    goal2Model.layers,
    goal2Model.kvHeads,
    goal2Model.headDim,
    goal2KvPrecision
  )

  const goal2Sim = calculateKvPreemption({
    totalGpuMemoryBytes: goal2TotalMemoryBytes,
    weightMemoryBytes: goal2WeightsBytes,
    overheadBytes: goal2OverheadBytes,
    kvPerTokenBytes: goal2KvPerTokenBytes,
    concurrentRequests: 16,
    contextLengthTokens: 4096,
  })

  // Goal 2 passes when all 16 users are served with 0 preemption and GPU count is minimal (2 GPUs)
  const goal2ZeroPreemption =
    goal2Sim.preemptedRequests === 0 && goal2Sim.servedRequests === 16
  const goal2FewestGpus = goal2GpuCount === 2
  const goal2Passed = goal2ZeroPreemption && goal2FewestGpus

  const bothGoalsPassed = goal1Passed && goal2Passed

  // Auto-complete callback when both challenge goals are achieved
  React.useEffect(() => {
    if (bothGoalsPassed && !isCompleted) {
      onComplete()
    }
  }, [bothGoalsPassed, isCompleted, onComplete])

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* 1. LEARN SECTION */}
      {/* ------------------------------------------------------------------ */}
      <LevelSectionContent section="learn">
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight">
              KV Cache Memory: The Real Concurrency Limit
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Every token in flight keeps attention keys and values in GPU
              memory (the KV cache) to avoid recalculating past context at every
              generation step.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              GPU VRAM is divided into three parts: static model weights, runtime
              overhead, and whatever remains for the KV cache.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Total KV memory scales directly as:{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono font-semibold text-primary">
                Concurrent Requests × Context Length × KV Cache per Token
              </code>
              . When user traffic exceeds available KV capacity, requests must be{" "}
              <strong>preempted</strong> (evicted), forcing costly recomputation
              when they are resumed.
            </p>
          </div>

          {/* GPU Memory Architecture Diagram */}
          <Card className="border bg-card/60 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <span>GPU Memory Partitioning & Per-Request KV Slices</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div
                role="figure"
                className="w-full rounded-md border bg-muted/30 p-4 space-y-4"
                aria-label="Diagram showing GPU memory partitioned into model weights, runtime overhead, and KV cache slices"
              >
                {/* Total GPU Memory Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium text-muted-foreground">
                    <span>Total GPU VRAM (e.g. 80 GB)</span>
                    <span className="font-mono">100% Allocation</span>
                  </div>

                  <div className="flex h-12 w-full overflow-hidden rounded-lg border text-white font-medium text-xs shadow-inner">
                    {/* Model Weights */}
                    <div
                      className="bg-indigo-600 flex flex-col items-center justify-center px-2 text-center"
                      style={{ width: "25%" }}
                    >
                      <span className="font-semibold">Weights</span>
                      <span className="text-[10px] text-indigo-100">16 GB (FP16)</span>
                    </div>

                    {/* Overhead */}
                    <div
                      className="bg-slate-600 flex flex-col items-center justify-center px-1 text-center"
                      style={{ width: "10%" }}
                    >
                      <span className="font-semibold">Overhead</span>
                      <span className="text-[10px] text-slate-200">~4 GB</span>
                    </div>

                    {/* KV Cache Pool */}
                    <div
                      className="bg-emerald-600 flex-1 flex flex-col items-center justify-center px-2 text-center"
                    >
                      <span className="font-semibold">KV Cache Pool (60 GB Free)</span>
                      <span className="text-[10px] text-emerald-100">
                        Divided into per-request slices
                      </span>
                    </div>
                  </div>
                </div>

                {/* Slices Zoom-in */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <span>Active KV Cache Pool Slices</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Demand ≤ Capacity: Normal Serving
                    </span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 text-center font-mono text-[11px]">
                    <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300">
                      Req #1 Slice
                    </div>
                    <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300">
                      Req #2 Slice
                    </div>
                    <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300">
                      Req #3 Slice
                    </div>
                    <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300">
                      Req #4 Slice
                    </div>
                    <div className="rounded border border-dashed border-emerald-500/30 bg-muted/40 p-2 text-muted-foreground col-span-2 flex items-center justify-center">
                      Remaining Free KV
                    </div>
                  </div>
                </div>

                {/* Preemption Callout */}
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2.5 text-xs text-destructive">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-semibold">
                      What happens when KV memory runs out?
                    </span>
                    <p className="text-destructive/90 leading-relaxed">
                      If concurrent requests or context lengths exceed the free
                      KV pool, the serving engine must <strong>preempt</strong>{" "}
                      excess requests. Their KV cache is evicted from VRAM. When
                      later resumed, all past tokens must be{" "}
                      <strong>recomputed</strong> from scratch via prefill,
                      wasting GPU compute and spiking latency.
                    </p>
                  </div>
                </div>
              </div>

              {/* Jargon Glossary */}
              <div className="grid gap-2.5 sm:grid-cols-3 pt-2">
                <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                  <span className="font-semibold text-primary">KV Cache</span>
                  <p className="text-muted-foreground leading-relaxed">
                    Key and Value activation vectors saved per layer and token
                    so attention does not re-attend to past tokens from scratch.
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                  <span className="font-semibold text-primary">Preemption</span>
                  <p className="text-muted-foreground leading-relaxed">
                    Temporarily pausing and evicting an active request&apos;s KV
                    cache when GPU VRAM is completely exhausted.
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                  <span className="font-semibold text-primary">
                    Recomputation
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    Re-running prompt prefill from token 0 when a preempted
                    request resumes, costing duplicate GPU FLOPS.
                  </p>
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

      {/* ------------------------------------------------------------------ */}
      {/* 2. TRY SECTION */}
      {/* ------------------------------------------------------------------ */}
      <LevelSectionContent section="try">
        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">
              KV Cache Memory Simulator
            </h3>
            <p className="text-muted-foreground text-sm">
              Tweak model size, GPU hardware, context length, and concurrent
              requests to watch the memory gauge fill up and observe preemption.
            </p>
          </div>

          {/* Interactive Controls Grid */}
          <div className="grid gap-4 sm:grid-cols-2 rounded-lg border p-4 bg-muted/20">
            {/* Model Architecture */}
            <div className="space-y-1.5">
              <Label id="try-model-label" htmlFor="try-model">
                Model Architecture
              </Label>
              <ToggleGroup
                id="try-model"
                aria-labelledby="try-model-label"
                type="single"
                value={modelId}
                onValueChange={(val: string) => {
                  if (val) setModelId(val)
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="llama-3-8b" className="flex-1">
                  Llama-3-8B
                </ToggleGroupItem>
                <ToggleGroupItem value="llama-3-70b" className="flex-1">
                  Llama-3-70B
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* GPU Architecture */}
            <div className="space-y-1.5">
              <Label id="try-gpu-label" htmlFor="try-gpu">
                GPU Hardware
              </Label>
              <ToggleGroup
                id="try-gpu"
                aria-labelledby="try-gpu-label"
                type="single"
                value={gpuId}
                onValueChange={(val: string) => {
                  if (val) setGpuId(val)
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="a100-80gb" className="flex-1">
                  A100 (80GB)
                </ToggleGroupItem>
                <ToggleGroupItem value="h100-80gb" className="flex-1">
                  H100 (80GB)
                </ToggleGroupItem>
                <ToggleGroupItem value="l40s-48gb" className="flex-1">
                  L40S (48GB)
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Number of GPUs */}
            <div className="space-y-1.5">
              <Label id="try-gpu-count-label" htmlFor="try-gpu-count">
                Number of GPUs
              </Label>
              <ToggleGroup
                id="try-gpu-count"
                aria-labelledby="try-gpu-count-label"
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

            {/* KV Cache Precision */}
            <div className="space-y-1.5">
              <Label id="try-kv-precision-label" htmlFor="try-kv-precision">
                KV Cache Precision
              </Label>
              <ToggleGroup
                id="try-kv-precision"
                aria-labelledby="try-kv-precision-label"
                type="single"
                value={kvPrecision}
                onValueChange={(val: string) => {
                  if (val) setKvPrecision(val as KvPrecision)
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="FP16" className="flex-1">
                  FP16 (2 bytes)
                </ToggleGroupItem>
                <ToggleGroupItem value="FP8" className="flex-1">
                  FP8 (1 byte)
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Context Length */}
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex justify-between items-center">
                <Label id="try-context-label" htmlFor="try-context">
                  Context Length
                </Label>
                <span className="font-mono text-xs text-muted-foreground">
                  {contextLength.toLocaleString()} tokens
                </span>
              </div>
              <ToggleGroup
                id="try-context"
                aria-labelledby="try-context-label"
                type="single"
                value={String(contextLength)}
                onValueChange={(val: string) => {
                  if (val) setContextLength(parseInt(val, 10))
                }}
                variant="outline"
                className="w-full grid grid-cols-4 sm:grid-cols-8"
              >
                {CONTEXT_OPTIONS.map((opt) => (
                  <ToggleGroupItem
                    key={opt.tokens}
                    value={String(opt.tokens)}
                    className="text-xs"
                  >
                    {opt.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {/* Concurrent Requests */}
            <div className="space-y-2 sm:col-span-2">
              <div className="flex justify-between items-center">
                <Label id="try-concurrency-label" htmlFor="try-concurrency">
                  Concurrent Requests (1–256)
                </Label>
                <span className="font-mono text-xs font-semibold text-primary">
                  {concurrentRequests} concurrent users
                </span>
              </div>
              <input
                id="try-concurrency"
                type="range"
                min={1}
                max={256}
                step={1}
                value={concurrentRequests}
                onChange={(e) => setConcurrentRequests(Number(e.target.value))}
                className="w-full cursor-pointer"
                aria-labelledby="try-concurrency-label"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-muted-foreground mr-1">
                  Presets:
                </span>
                {CONCURRENCY_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    size="sm"
                    variant={
                      concurrentRequests === preset ? "default" : "outline"
                    }
                    onClick={() => setConcurrentRequests(preset)}
                    className="h-6 px-2 text-xs"
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Memory Gauge Display */}
          <Card className="border">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Server className="size-4 text-primary" />
                  <span>
                    GPU Memory Allocation Gauge ({totalGpuMemoryGb} GB Total)
                  </span>
                </CardTitle>
                <Badge
                  variant={simulation.isPreempted ? "destructive" : "secondary"}
                  className="w-fit"
                >
                  {simulation.isPreempted
                    ? `${simulation.preemptedRequests} Preempted`
                    : "0 Preempted ✓"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Stacked Memory Gauge Bar */}
              <div className="space-y-1.5">
                <div
                  className="flex h-8 w-full overflow-hidden rounded-md border bg-muted text-[11px] font-medium text-white shadow-inner"
                  role="progressbar"
                  aria-label="GPU memory allocation gauge"
                  aria-valuenow={Math.round(weightsPercent + overheadPercent + kvInUsePercent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  {weightsPercent > 0 && (
                    <div
                      className="bg-indigo-600 flex items-center justify-center truncate px-1 text-center"
                      style={{ width: `${weightsPercent}%` }}
                      title={`Weights: ${weightMemoryGb.toFixed(1)} GB (${weightsPercent.toFixed(1)}%)`}
                    >
                      {weightsPercent > 12 && "Weights"}
                    </div>
                  )}

                  {overheadPercent > 0 && (
                    <div
                      className="bg-slate-600 flex items-center justify-center truncate px-1 text-center"
                      style={{ width: `${overheadPercent}%` }}
                      title={`Overhead: ${overheadGb.toFixed(1)} GB (${overheadPercent.toFixed(1)}%)`}
                    >
                      {overheadPercent > 10 && "Overhead"}
                    </div>
                  )}

                  {kvInUsePercent > 0 && (
                    <div
                      className={`${
                        simulation.isPreempted ? "bg-amber-600" : "bg-emerald-600"
                      } flex items-center justify-center truncate px-1 text-center`}
                      style={{ width: `${kvInUsePercent}%` }}
                      title={`KV Cache In Use: ${simulation.kvInUseGb.toFixed(1)} GB (${kvInUsePercent.toFixed(1)}%)`}
                    >
                      {kvInUsePercent > 12 && "KV In Use"}
                    </div>
                  )}

                  {freeRemainingPercent > 0 && (
                    <div
                      className="bg-muted text-muted-foreground flex items-center justify-center truncate px-1 text-center"
                      style={{ width: `${freeRemainingPercent}%` }}
                      title={`Free Memory: ${freeRemainingGb.toFixed(1)} GB (${freeRemainingPercent.toFixed(1)}%)`}
                    >
                      {freeRemainingPercent > 15 && "Free VRAM"}
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2.5 rounded-sm bg-indigo-600 shrink-0" />
                    <span>
                      Weights: <strong>{weightMemoryGb.toFixed(1)} GB</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="size-2.5 rounded-sm bg-slate-600 shrink-0" />
                    <span>
                      Overhead: <strong>{overheadGb.toFixed(1)} GB</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`size-2.5 rounded-sm shrink-0 ${
                        simulation.isPreempted ? "bg-amber-600" : "bg-emerald-600"
                      }`}
                    />
                    <span>
                      KV In Use:{" "}
                      <strong>{simulation.kvInUseGb.toFixed(1)} GB</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="size-2.5 rounded-sm bg-muted border shrink-0" />
                    <span>
                      Free KV:{" "}
                      <strong>{freeRemainingGb.toFixed(1)} GB</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Preemption Alert or Serving Status */}
              {simulation.isPreempted ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2 text-destructive"
                >
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>
                      Preemption Detected: {simulation.preemptedRequests} of{" "}
                      {concurrentRequests} requests preempted!
                    </span>
                  </div>
                  <p className="text-xs text-destructive/90 leading-relaxed">
                    Total KV demand ({simulation.totalDemandKvGb.toFixed(1)} GB)
                    exceeds available KV cache capacity (
                    {simulation.freeMemoryGb.toFixed(1)} GB) by{" "}
                    <strong>{simulation.shortfallGb.toFixed(1)} GB</strong>.
                  </p>
                  <p className="text-xs text-destructive/90 leading-relaxed border-t border-destructive/20 pt-2">
                    <strong>Why this hurts (Recomputation):</strong> Preempted
                    requests cannot be accommodated in GPU VRAM and are evicted.
                    When later resumed, all prior {contextLength.toLocaleString()}{" "}
                    tokens must be recomputed from scratch, wasting GPU FLOPS
                    and causing high latency spikes.
                  </p>
                </div>
              ) : (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      <strong>All {concurrentRequests} requests served</strong>{" "}
                      without preemption. (Max concurrency capacity:{" "}
                      <strong>{simulation.maxConcurrency}</strong> requests at{" "}
                      {contextLength.toLocaleString()} tokens).
                    </span>
                  </div>
                </div>
              )}

              {/* Request Serving Visual Grid */}
              <div className="space-y-1.5 pt-2 border-t">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    <span>Active Request Slices ({concurrentRequests} total)</span>
                  </span>
                  <span>
                    Served: {simulation.servedRequests} · Preempted:{" "}
                    {simulation.preemptedRequests}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-2 rounded-md border bg-muted/20">
                  {Array.from({ length: concurrentRequests }).map((_, i) => {
                    const isServed = i < simulation.servedRequests
                    return (
                      <div
                        key={i}
                        className={`size-6 text-[10px] font-mono font-semibold rounded flex items-center justify-center border ${
                          isServed
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                            : "bg-destructive/20 text-destructive border-destructive/40"
                        }`}
                        title={
                          isServed
                            ? `Request #${i + 1}: Served`
                            : `Request #${i + 1}: Preempted`
                        }
                      >
                        {i + 1}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Formula and Math Breakdown */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
                <div className="font-semibold text-primary flex items-center gap-1.5">
                  <Zap className="size-3.5" />
                  <span>Underlying Formulas & Values (model.ts)</span>
                </div>
                <div className="space-y-1 font-mono text-[11px] text-muted-foreground leading-relaxed">
                  <div>
                    KV cache per token = 2 × layers ({activeModel.layers}) × KV heads (
                    {activeModel.kvHeads}) × head dim ({activeModel.headDim}) × bytes (
                    {kvPrecision === "FP16" ? 2 : 1}) ={" "}
                    <strong className="text-foreground">
                      {kvPerTokenBytes.toLocaleString()} bytes (
                      {kvPerTokenKb.toFixed(1)} KB)
                    </strong>
                  </div>
                  <div>
                    Total KV demand = {concurrentRequests} requests ×{" "}
                    {contextLength.toLocaleString()} tokens ×{" "}
                    {kvPerTokenKb.toFixed(1)} KB ={" "}
                    <strong className="text-foreground">
                      {simulation.totalDemandKvGb.toFixed(2)} GB
                    </strong>
                  </div>
                  <div>
                    KV capacity tokens = (GPU VRAM [{totalGpuMemoryGb} GB] −
                    Weights [{weightMemoryGb.toFixed(1)} GB] − Overhead [
                    {overheadGb.toFixed(1)} GB]) ÷ KV per token ={" "}
                    <strong className="text-foreground">
                      {simulation.kvCapacityTokens.toLocaleString()} tokens
                    </strong>
                  </div>
                  <div>
                    Max concurrency = floor(
                    {simulation.kvCapacityTokens.toLocaleString()} tokens ÷{" "}
                    {contextLength.toLocaleString()} tokens) ={" "}
                    <strong className="text-foreground">
                      {simulation.maxConcurrency} concurrent requests
                    </strong>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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

      {/* ------------------------------------------------------------------ */}
      {/* 3. CHALLENGE SECTION */}
      {/* ------------------------------------------------------------------ */}
      <LevelSectionContent section="challenge">
        <div className="space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight">
                Level 3 Challenges
              </h3>
              {bothGoalsPassed ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
                  Completed ✓
                </Badge>
              ) : (
                <Badge variant="secondary">2 Goals</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Apply your KV cache capacity formulas to solve two real-world GPU
              serving puzzles.
            </p>
          </div>

          {/* Goal 1 Card */}
          <Card
            className={
              goal1Passed
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-border"
            }
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="size-4 text-primary" />
                    <span>
                      Challenge 1: Llama-3-8B · 32 Users @ 8K on 1 GPU
                    </span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Serve 32 concurrent users at 8K context (8,192 tokens) on
                    Llama-3-8B without preemption, using only one GPU.
                  </p>
                </div>
                <Badge
                  variant={goal1Passed ? "default" : "outline"}
                  className={
                    goal1Passed
                      ? "bg-emerald-600 hover:bg-emerald-600 text-white shrink-0"
                      : "shrink-0"
                  }
                >
                  {goal1Passed ? "Goal 1 Passed ✓" : "Incomplete"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 rounded-lg border p-3 bg-muted/20">
                {/* GPU Choice */}
                <div className="space-y-1.5">
                  <Label id="goal1-gpu-label" htmlFor="goal1-gpu">
                    Select GPU Model (1 GPU)
                  </Label>
                  <ToggleGroup
                    id="goal1-gpu"
                    aria-labelledby="goal1-gpu-label"
                    type="single"
                    value={goal1GpuId}
                    onValueChange={(val: string) => {
                      if (val) setGoal1GpuId(val)
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <ToggleGroupItem value="l40s-48gb" className="flex-1 text-xs">
                      L40S (48GB)
                    </ToggleGroupItem>
                    <ToggleGroupItem value="a100-80gb" className="flex-1 text-xs">
                      A100 (80GB)
                    </ToggleGroupItem>
                    <ToggleGroupItem value="h100-80gb" className="flex-1 text-xs">
                      H100 (80GB)
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* KV Precision */}
                <div className="space-y-1.5">
                  <Label id="goal1-kv-label" htmlFor="goal1-kv">
                    KV Cache Precision
                  </Label>
                  <ToggleGroup
                    id="goal1-kv"
                    aria-label="KV Cache Precision (Challenge 1)"
                    type="single"
                    value={goal1KvPrecision}
                    onValueChange={(val: string) => {
                      if (val) setGoal1KvPrecision(val as KvPrecision)
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <ToggleGroupItem value="FP16" className="flex-1 text-xs">
                      FP16 (2 bytes)
                    </ToggleGroupItem>
                    <ToggleGroupItem value="FP8" className="flex-1 text-xs">
                      FP8 (1 byte)
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              {/* Goal 1 Outcome Feedback */}
              <div
                className={`rounded-md p-3 text-xs flex items-start gap-2.5 ${
                  goal1Passed
                    ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                    : "bg-destructive/10 text-destructive border border-destructive/30"
                }`}
              >
                {goal1Passed ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                ) : (
                  <XCircle className="size-4 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-semibold">
                    {goal1Passed
                      ? "Success: 32/32 users served with 0 preemption!"
                      : `Failed: ${goal1Sim.preemptedRequests} requests preempted.`}
                  </span>
                  <p className="mt-0.5 leading-relaxed text-muted-foreground">
                    {goal1Passed
                      ? `Demand (${goal1Sim.totalDemandKvGb.toFixed(1)} GB) fits comfortably within ${goal1Gpu.name} free KV pool (${goal1Sim.freeMemoryGb.toFixed(1)} GB).`
                      : `On ${goal1Gpu.name} (${goal1Gpu.memoryGb} GB), free KV is only ${goal1Sim.freeMemoryGb.toFixed(1)} GB, but 32 users @ 8K FP16 require ${goal1Sim.totalDemandKvGb.toFixed(1)} GB. Try an 80GB GPU or FP8 KV cache.`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Goal 2 Card */}
          <Card
            className={
              goal2Passed
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-border"
            }
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="size-4 text-primary" />
                    <span>
                      Challenge 2: Llama-3-70B · 16 Users @ 4K with Fewest GPUs
                    </span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Serve 16 concurrent users at 4K context on Llama-3-70B
                    without preemption using the minimum number of GPUs (try FP8
                    KV cache).
                  </p>
                </div>
                <Badge
                  variant={goal2Passed ? "default" : "outline"}
                  className={
                    goal2Passed
                      ? "bg-emerald-600 hover:bg-emerald-600 text-white shrink-0"
                      : "shrink-0"
                  }
                >
                  {goal2Passed ? "Goal 2 Passed ✓" : "Incomplete"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3 rounded-lg border p-3 bg-muted/20">
                {/* GPU Choice */}
                <div className="space-y-1.5">
                  <Label id="goal2-gpu-label" htmlFor="goal2-gpu">
                    GPU Hardware
                  </Label>
                  <ToggleGroup
                    id="goal2-gpu"
                    aria-labelledby="goal2-gpu-label"
                    type="single"
                    value={goal2GpuId}
                    onValueChange={(val: string) => {
                      if (val) setGoal2GpuId(val)
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <ToggleGroupItem value="a100-80gb" className="flex-1 text-xs">
                      A100 (80GB)
                    </ToggleGroupItem>
                    <ToggleGroupItem value="h100-80gb" className="flex-1 text-xs">
                      H100 (80GB)
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* Number of GPUs */}
                <div className="space-y-1.5">
                  <Label id="goal2-count-label" htmlFor="goal2-count">
                    GPU Count
                  </Label>
                  <ToggleGroup
                    id="goal2-count"
                    aria-labelledby="goal2-count-label"
                    type="single"
                    value={String(goal2GpuCount)}
                    onValueChange={(val: string) => {
                      if (val) setGoal2GpuCount(parseInt(val, 10))
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <ToggleGroupItem value="1" className="flex-1 text-xs">
                      1
                    </ToggleGroupItem>
                    <ToggleGroupItem value="2" className="flex-1 text-xs">
                      2
                    </ToggleGroupItem>
                    <ToggleGroupItem value="4" className="flex-1 text-xs">
                      4
                    </ToggleGroupItem>
                    <ToggleGroupItem value="8" className="flex-1 text-xs">
                      8
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* KV Precision */}
                <div className="space-y-1.5">
                  <Label id="goal2-kv-label" htmlFor="goal2-kv">
                    KV Cache Precision
                  </Label>
                  <ToggleGroup
                    id="goal2-kv"
                    aria-label="KV Cache Precision (Challenge 2)"
                    type="single"
                    value={goal2KvPrecision}
                    onValueChange={(val: string) => {
                      if (val) setGoal2KvPrecision(val as KvPrecision)
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <ToggleGroupItem value="FP16" className="flex-1 text-xs">
                      FP16 (2 bytes)
                    </ToggleGroupItem>
                    <ToggleGroupItem value="FP8" className="flex-1 text-xs">
                      FP8 (1 byte)
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              {/* Goal 2 Outcome Feedback */}
              <div
                className={`rounded-md p-3 text-xs flex items-start gap-2.5 ${
                  goal2Passed
                    ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                    : "bg-destructive/10 text-destructive border border-destructive/30"
                }`}
              >
                {goal2Passed ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                ) : (
                  <XCircle className="size-4 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-semibold">
                    {goal2Passed
                      ? "Success: 16/16 users served with 0 preemption on 2 GPUs!"
                      : goal2ZeroPreemption
                      ? `Preemption eliminated, but ${goal2GpuCount} GPUs is not the fewest possible.`
                      : goal2GpuCount === 1
                      ? "Model weights (140 GB) exceed single GPU memory (80 GB)."
                      : `Failed: ${goal2Sim.preemptedRequests} requests preempted.`}
                  </span>
                  <p className="mt-0.5 leading-relaxed text-muted-foreground">
                    {goal2Passed
                      ? "FP8 KV cache halved memory per token from 327.7 KB to 163.8 KB, fitting all 16 users into the 12 GB free pool on 2x 80GB GPUs."
                      : goal2ZeroPreemption
                      ? "You eliminated preemption, but can you serve this workload with FEWER GPUs? Try 2 GPUs with FP8 KV cache."
                      : goal2GpuCount === 1
                      ? "Llama-3-70B requires at least 2x 80GB GPUs just to hold the weights."
                      : "At FP16 KV cache, 16 users require 21.5 GB, exceeding the 12 GB available on 2 GPUs. Switch KV cache precision to FP8 to halve the memory bill!"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completion Celebration Card */}
          {bothGoalsPassed && (
            <Card className="border-emerald-500/40 bg-emerald-500/10">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                      Level 3 Challenges Solved!
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      You proved that concurrency is bounded by the free KV
                      cache pool, and demonstrated how FP8 KV cache cuts your
                      hardware requirement from 4 GPUs down to 2.
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
                        <span>Level 3 Completed ✓</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        <span>Complete Level 3 Challenge</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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

      {/* ------------------------------------------------------------------ */}
      {/* 4. RECAP SECTION */}
      {/* ------------------------------------------------------------------ */}
      <LevelSectionContent section="recap">
        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">Key Takeaways</h3>
            <p className="text-muted-foreground text-sm">
              Essential heuristics for managing KV cache memory in production:
            </p>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold">
                  KV Cache per Token Formula
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <code className="font-mono text-primary bg-muted px-1 rounded">
                    2 × layers × KV heads × head dim × bytes per element
                  </code>
                  . Key and Value vectors must be kept in VRAM for every layer
                  across all generation steps.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold">
                  Context Length × Concurrency is the Real Memory Bill
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  While model weights are static, KV cache memory scales
                  linearly with both context window and active users. Under long
                  prompts or high traffic, KV cache memory quickly dwarfs the
                  model weights.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold">
                  FP8 KV Cache Cuts Memory by 50%
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Quantizing the KV cache from FP16 (2 bytes) to FP8 (1 byte)
                  halves the memory per token, directly doubling concurrency
                  capacity or halving the number of GPUs needed without retraining
                  weights.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Cpu className="size-4 text-primary" />
              <span>Production Serving Note (vLLM, TensorRT-LLM)</span>
            </div>
            <p className="leading-relaxed">
              Modern inference engines use PagedAttention to eliminate memory
              fragmentation, but the physical laws of VRAM capacity remain
              identical: when total token demand exceeds free memory, preemption
              and costly prefill recomputation occur.
            </p>
          </div>

          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setActiveSection("challenge")}
            >
              Back to Challenge
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Level 3 Complete
              </Badge>
            </div>
          </div>
        </div>
      </LevelSectionContent>
    </div>
  )
}
