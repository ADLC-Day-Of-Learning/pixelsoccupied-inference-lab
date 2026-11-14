import * as React from "react"
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Gauge,
  HelpCircle,
  Layers,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  simulateBatching,
  sweepBatchSizes,
  type BatchingMode,
} from "@/lib/batching"

export function Level4Component({ onComplete }: LevelProps) {
  const { setActiveSection, isCompleted } = useLevelLayout()

  // Interactive controls for Try / Challenge
  const [mode, setMode] = React.useState<BatchingMode>("continuous")
  const [batchSize, setBatchSize] = React.useState(24)
  const [arrivalRate, setArrivalRate] = React.useState(30)
  const [isFormulaOpen, setIsFormulaOpen] = React.useState(false)

  // Record comparison runs for Challenge 2: `${batchSize}-${arrivalRate}` -> { static?: number, continuous?: number }
  const [history, setHistory] = React.useState<
    Record<string, { static?: number; continuous?: number }>
  >({})

  const historyKey = `${batchSize}-${arrivalRate}`

  // Run simulation whenever controls change
  const simResult = React.useMemo(() => {
    return simulateBatching({
      mode,
      batchSize,
      arrivalRate,
      seed: 42,
    })
  }, [mode, batchSize, arrivalRate])

  // Chart sweep data across batch sizes 1 to 64
  const sweepData = React.useMemo(() => {
    return sweepBatchSizes({
      mode,
      arrivalRate,
      seed: 42,
    })
  }, [mode, arrivalRate])

  // Automatically record runs for Challenge 2
  React.useEffect(() => {
    setHistory((prev) => {
      const existing = prev[historyKey] ?? {}
      if (mode === "static" && existing.static === simResult.tokensPerSecond) {
        return prev
      }
      if (
        mode === "continuous" &&
        existing.continuous === simResult.tokensPerSecond
      ) {
        return prev
      }
      return {
        ...prev,
        [historyKey]: {
          ...existing,
          [mode]: simResult.tokensPerSecond,
        },
      }
    })
  }, [historyKey, mode, simResult.tokensPerSecond])

  // Compare both modes at the current batch size button handler
  const handleRunComparison = React.useCallback(() => {
    const staticRun = simulateBatching({
      mode: "static",
      batchSize,
      arrivalRate,
      seed: 42,
    })
    const continuousRun = simulateBatching({
      mode: "continuous",
      batchSize,
      arrivalRate,
      seed: 42,
    })
    const key = `${batchSize}-${arrivalRate}`
    setHistory((prev) => ({
      ...prev,
      [key]: {
        static: staticRun.tokensPerSecond,
        continuous: continuousRun.tokensPerSecond,
      },
    }))
  }, [batchSize, arrivalRate])

  // Challenge evaluation
  const LATENCY_SLO_SEC = 2.0
  const TARGET_THROUGHPUT = 2000

  // Goal 1: Throughput >= 2000 tokens/s AND p95 <= 2.0s
  const goal1Passed =
    simResult.tokensPerSecond >= TARGET_THROUGHPUT &&
    simResult.p95LatencySec <= LATENCY_SLO_SEC

  // Goal 2: Continuous batching beats static batching at the same batch size
  const comparison = history[historyKey]
  const goal2Passed = Boolean(
    comparison?.static !== undefined &&
      comparison?.continuous !== undefined &&
      comparison.continuous > comparison.static
  )

  const allGoalsMet = goal1Passed && goal2Passed

  return (
    <div className="space-y-6">
      {/* 1. LEARN SECTION */}
      <LevelSectionContent section="learn">
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight">
              Batching: Static vs Continuous
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              In LLM decoding, streaming model weights from GPU memory into
              compute cores is the primary bottleneck. Batching groups multiple
              requests together so one weight load is amortized across many
              tokens, multiplying serving throughput.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong>Static batching</strong> waits until every request in the
              batch finishes before admitting new ones, leaving compute slots
              idle when shorter requests finish early.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong>Continuous batching</strong> (iteration-level scheduling)
              inserts waiting requests into freed slots on every single token
              step, eliminating idle bubbles and maximizing GPU utilization.
            </p>
          </div>

          {/* Inline SVG Diagram */}
          <Card className="bg-muted/20 border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <span>Execution Timeline: Static vs Continuous Batching</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                role="img"
                aria-label="Diagram showing static batching with idle bubbles waiting for the slowest request versus continuous batching refilling slots immediately"
                className="w-full overflow-x-auto"
              >
                <svg
                  viewBox="0 0 680 260"
                  className="w-full min-w-[500px] h-auto text-xs font-mono select-none"
                >
                  {/* Background grid */}
                  <rect
                    width="680"
                    height="260"
                    rx="8"
                    className="fill-card stroke-border"
                    strokeWidth="1"
                  />

                  {/* Top section: Static Batching */}
                  <text
                    x="24"
                    y="30"
                    className="fill-foreground font-sans font-bold text-sm"
                  >
                    Static Batching (waits for longest request)
                  </text>

                  {/* Slot 1: finishes early */}
                  <text x="24" y="60" className="fill-muted-foreground font-sans">
                    Slot 1 (Req A)
                  </text>
                  <rect
                    x="130"
                    y="46"
                    width="140"
                    height="20"
                    rx="3"
                    className="fill-primary/80"
                  />
                  <text x="140" y="60" className="fill-primary-foreground text-[10px]">
                    Decoding 40 tokens
                  </text>
                  <rect
                    x="274"
                    y="46"
                    width="280"
                    height="20"
                    rx="3"
                    className="fill-muted stroke-destructive/40 stroke-dashed"
                    strokeDasharray="4 2"
                  />
                  <text
                    x="350"
                    y="60"
                    className="fill-destructive dark:fill-destructive font-semibold text-[10px]"
                  >
                    IDLE BUBBLE (Slot wasted)
                  </text>

                  {/* Slot 2: longest request */}
                  <text x="24" y="90" className="fill-muted-foreground font-sans">
                    Slot 2 (Req B)
                  </text>
                  <rect
                    x="130"
                    y="76"
                    width="424"
                    height="20"
                    rx="3"
                    className="fill-primary"
                  />
                  <text x="140" y="90" className="fill-primary-foreground text-[10px]">
                    Decoding 140 tokens (Slowest request in batch)
                  </text>

                  {/* Slot 3: medium request */}
                  <text x="24" y="120" className="fill-muted-foreground font-sans">
                    Slot 3 (Req C)
                  </text>
                  <rect
                    x="130"
                    y="106"
                    width="220"
                    height="20"
                    rx="3"
                    className="fill-primary/80"
                  />
                  <text x="140" y="120" className="fill-primary-foreground text-[10px]">
                    Decoding 70 tokens
                  </text>
                  <rect
                    x="354"
                    y="106"
                    width="200"
                    height="20"
                    rx="3"
                    className="fill-muted stroke-destructive/40 stroke-dashed"
                    strokeDasharray="4 2"
                  />
                  <text
                    x="390"
                    y="120"
                    className="fill-destructive dark:fill-destructive font-semibold text-[10px]"
                  >
                    IDLE BUBBLE
                  </text>

                  {/* Batch boundary barrier line */}
                  <line
                    x1="554"
                    y1="42"
                    x2="554"
                    y2="132"
                    className="stroke-destructive"
                    strokeWidth="2"
                    strokeDasharray="2 2"
                  />
                  <text
                    x="562"
                    y="90"
                    className="fill-destructive font-sans font-semibold text-[11px]"
                  >
                    Next batch blocked
                  </text>

                  {/* Divider */}
                  <line
                    x1="24"
                    y1="142"
                    x2="656"
                    y2="142"
                    className="stroke-border"
                    strokeWidth="1"
                  />

                  {/* Bottom section: Continuous Batching */}
                  <text
                    x="24"
                    y="166"
                    className="fill-foreground font-sans font-bold text-sm"
                  >
                    Continuous Batching (iteration-level scheduling)
                  </text>

                  {/* Slot 1: immediately refilled with Req D */}
                  <text x="24" y="196" className="fill-muted-foreground font-sans">
                    Slot 1 (Req A)
                  </text>
                  <rect
                    x="130"
                    y="182"
                    width="140"
                    height="20"
                    rx="3"
                    className="fill-primary/80"
                  />
                  <text x="140" y="196" className="fill-primary-foreground text-[10px]">
                    Req A (40 tok)
                  </text>
                  <rect
                    x="274"
                    y="182"
                    width="310"
                    height="20"
                    rx="3"
                    className="fill-emerald-600 dark:fill-emerald-500"
                  />
                  <text
                    x="284"
                    y="196"
                    className="fill-white font-semibold text-[10px]"
                  >
                    Req D joins immediately at step 41!
                  </text>

                  {/* Slot 2: active */}
                  <text x="24" y="226" className="fill-muted-foreground font-sans">
                    Slot 2 (Req B)
                  </text>
                  <rect
                    x="130"
                    y="212"
                    width="424"
                    height="20"
                    rx="3"
                    className="fill-primary"
                  />
                  <text x="140" y="226" className="fill-primary-foreground text-[10px]">
                    Req B (140 tokens continuous)
                  </text>

                  {/* Slot 3: immediately refilled with Req E */}
                  <text x="24" y="246" className="fill-muted-foreground font-sans">
                    Slot 3 (Req C)
                  </text>
                  <rect
                    x="130"
                    y="238"
                    width="220"
                    height="18"
                    rx="3"
                    className="fill-primary/80"
                  />
                  <text x="140" y="251" className="fill-primary-foreground text-[9px]">
                    Req C (70 tok)
                  </text>
                  <rect
                    x="354"
                    y="238"
                    width="230"
                    height="18"
                    rx="3"
                    className="fill-emerald-600 dark:fill-emerald-500"
                  />
                  <text
                    x="364"
                    y="251"
                    className="fill-white font-semibold text-[9px]"
                  >
                    Req E joins immediately at step 71!
                  </text>
                </svg>
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

      {/* 2. TRY SECTION */}
      <LevelSectionContent section="try">
        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">
              Batching Sandbox
            </h3>
            <p className="text-sm text-muted-foreground">
              Experiment with static and continuous batching across different
              batch sizes and arrival rates to see how throughput and latency
              interact.
            </p>
          </div>

          {/* Interactive Controls */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold">
                Serving Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* 1. Batching Strategy ToggleGroup */}
                <div className="space-y-2">
                  <Label id="batch-mode-label" htmlFor="batch-mode">
                    Batching Strategy
                  </Label>
                  <ToggleGroup
                    id="batch-mode"
                    aria-labelledby="batch-mode-label"
                    type="single"
                    value={mode}
                    onValueChange={(val: string) => {
                      if (val) setMode(val as BatchingMode)
                    }}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <ToggleGroupItem value="static" className="flex-1">
                      Static
                    </ToggleGroupItem>
                    <ToggleGroupItem value="continuous" className="flex-1">
                      Continuous
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <p className="text-[11px] text-muted-foreground">
                    {mode === "static"
                      ? "Waits for slowest request; idle gaps until batch finishes."
                      : "Iteration-level: requests enter and exit every step."}
                  </p>
                </div>

                {/* 2. Max Batch Size Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label id="batch-size-label" htmlFor="batch-size-slider">
                      Max Batch Size
                    </Label>
                    <span className="text-xs font-mono font-bold text-primary">
                      {batchSize} requests
                    </span>
                  </div>
                  <input
                    id="batch-size-slider"
                    aria-labelledby="batch-size-label"
                    type="range"
                    min={1}
                    max={64}
                    step={1}
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>1 (Single)</span>
                    <span>16</span>
                    <span>32</span>
                    <span>64 (Max)</span>
                  </div>
                </div>

                {/* 3. Arrival Rate Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label id="arrival-rate-label" htmlFor="arrival-rate-slider">
                      Request Arrival Rate
                    </Label>
                    <span className="text-xs font-mono font-bold text-primary">
                      {arrivalRate} req/s
                    </span>
                  </div>
                  <input
                    id="arrival-rate-slider"
                    aria-labelledby="arrival-rate-label"
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={arrivalRate}
                    onChange={(e) => setArrivalRate(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>5 req/s (Low)</span>
                    <span>25 req/s</span>
                    <span>50 req/s (Heavy)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Metrics Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Throughput
                  </span>
                  <Zap className="size-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-primary">
                  {simResult.tokensPerSecond.toLocaleString()} tokens/s
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Aggregate token generation rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    p95 Latency
                  </span>
                  <Clock
                    className={`size-4 ${
                      simResult.p95LatencySec <= LATENCY_SLO_SEC
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive"
                    }`}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold font-mono ${
                    simResult.p95LatencySec <= LATENCY_SLO_SEC
                      ? "text-foreground"
                      : "text-destructive"
                  }`}
                >
                  {simResult.p95LatencySec.toFixed(2)} s
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge
                    variant={
                      simResult.p95LatencySec <= LATENCY_SLO_SEC
                        ? "secondary"
                        : "destructive"
                    }
                    className="text-[10px] px-1.5 py-0 h-4 font-mono"
                  >
                    SLO: {LATENCY_SLO_SEC.toFixed(1)} s
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {simResult.p95LatencySec <= LATENCY_SLO_SEC
                      ? "Within SLO ✓"
                      : "Breaches SLO!"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    GPU Slot Utilization
                  </span>
                  <Gauge className="size-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">
                  {Math.round(simResult.gpuUtilization * 100)}%
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {mode === "continuous"
                    ? "Continuous fills empty slots"
                    : "Static wastes idle slots"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Decode Step Time
                  </span>
                  <Clock className="size-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">
                  {simResult.stepTimeMs} ms
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Per-token step across batch
                </p>
              </CardContent>
            </Card>
          </div>

          {/* SVG Chart: Throughput vs p95 Latency for Batch Sizes 1-64 */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Gauge className="size-4 text-primary" />
                  <span>
                    Throughput vs p95 Latency across Batch Sizes (1–64)
                  </span>
                </CardTitle>
                <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-primary inline-block" />
                    <span>Throughput (tokens/s)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-amber-500 inline-block" />
                    <span>p95 Latency (s)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 border-b-2 border-dashed border-destructive inline-block" />
                    <span>SLO (2.0s)</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                role="img"
                aria-label="Chart showing throughput rising with batch size and p95 latency curve crossing the 2.0 second SLO line"
                className="w-full overflow-x-auto"
              >
                <svg
                  viewBox="0 0 540 220"
                  className="w-full min-w-[420px] h-auto text-[11px] font-mono select-none"
                >
                  {/* Chart area coordinates: x: 40 to 500, y: 20 to 180 */}
                  <rect
                    x="40"
                    y="20"
                    width="460"
                    height="160"
                    className="fill-muted/20 stroke-border"
                    strokeWidth="1"
                  />

                  {/* Latency SLO horizontal line at 2.0 s (y = 110 where max Y is 4.0s) */}
                  <line
                    x1="40"
                    y1="100"
                    x2="500"
                    y2="100"
                    className="stroke-destructive"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  <text
                    x="42"
                    y="94"
                    className="fill-destructive font-sans font-bold text-[10px]"
                  >
                    Latency SLO (2.0 s)
                  </text>

                  {/* Grid lines */}
                  <line
                    x1="40"
                    y1="60"
                    x2="500"
                    y2="60"
                    className="stroke-border/40"
                    strokeDasharray="2 2"
                  />
                  <line
                    x1="40"
                    y1="140"
                    x2="500"
                    y2="140"
                    className="stroke-border/40"
                    strokeDasharray="2 2"
                  />

                  {/* Draw latency points & line (amber) */}
                  <polyline
                    fill="none"
                    className="stroke-amber-500"
                    strokeWidth="2"
                    points={sweepData
                      .map((p) => {
                        const x = 40 + (p.batchSize / 64) * 460
                        // Map 0 to 4.0s latency to y: 180 down to 20
                        const y = Math.max(
                          20,
                          Math.min(180, 180 - (p.p95LatencySec / 4.0) * 160)
                        )
                        return `${x.toFixed(1)},${y.toFixed(1)}`
                      })
                      .join(" ")}
                  />

                  {/* Draw throughput points & line (primary) */}
                  <polyline
                    fill="none"
                    className="stroke-primary"
                    strokeWidth="2.5"
                    points={sweepData
                      .map((p) => {
                        const x = 40 + (p.batchSize / 64) * 460
                        // Map 0 to 3000 tokens/s to y: 180 down to 20
                        const y = Math.max(
                          20,
                          Math.min(180, 180 - (p.tokensPerSecond / 3000) * 160)
                        )
                        return `${x.toFixed(1)},${y.toFixed(1)}`
                      })
                      .join(" ")}
                  />

                  {/* Highlight current batch size with vertical indicator */}
                  {(() => {
                    const currentX = 40 + (batchSize / 64) * 460
                    return (
                      <g>
                        <line
                          x1={currentX}
                          y1="20"
                          x2={currentX}
                          y2="180"
                          className="stroke-foreground"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx={currentX}
                          cy={Math.max(
                            20,
                            Math.min(
                              180,
                              180 - (simResult.tokensPerSecond / 3000) * 160
                            )
                          )}
                          r="4"
                          className="fill-primary stroke-background"
                          strokeWidth="2"
                        />
                      </g>
                    )
                  })()}

                  {/* X axis labels */}
                  <text
                    x="40"
                    y="198"
                    className="fill-muted-foreground text-[10px]"
                  >
                    1
                  </text>
                  <text
                    x="155"
                    y="198"
                    className="fill-muted-foreground text-[10px]"
                  >
                    16
                  </text>
                  <text
                    x="270"
                    y="198"
                    className="fill-muted-foreground text-[10px]"
                  >
                    32
                  </text>
                  <text
                    x="385"
                    y="198"
                    className="fill-muted-foreground text-[10px]"
                  >
                    48
                  </text>
                  <text
                    x="490"
                    y="198"
                    className="fill-muted-foreground text-[10px]"
                  >
                    64
                  </text>
                  <text
                    x="240"
                    y="212"
                    className="fill-muted-foreground font-sans text-[10px] text-center"
                  >
                    Batch Size (Requests)
                  </text>
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* Collapsible formula explanation */}
          <Collapsible
            open={isFormulaOpen}
            onOpenChange={setIsFormulaOpen}
            className="rounded-lg border bg-card p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold">
                  How is this calculated?
                </span>
              </div>
              <CollapsibleTrigger
                render={
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    {isFormulaOpen ? "Hide formulas" : "Show formulas"}
                  </Button>
                }
              />
            </div>

            <CollapsibleContent className="space-y-3 pt-2 text-xs text-muted-foreground border-t">
              <div className="space-y-1">
                <div className="font-semibold text-foreground">
                  Decode Step Latency
                </div>
                <code className="block bg-muted px-2 py-1 rounded text-[11px] font-mono text-foreground">
                  {simResult.formulaExplanation.decodeStepTimeFormula}
                </code>
                <p>
                  At batch size {batchSize}, model weights are loaded once per
                  token step, plus KV cache reads for active requests.
                </p>
              </div>

              <div className="space-y-1">
                <div className="font-semibold text-foreground">
                  Throughput (tokens/s)
                </div>
                <code className="block bg-muted px-2 py-1 rounded text-[11px] font-mono text-foreground">
                  {simResult.formulaExplanation.throughputFormula}
                </code>
                <p>
                  Total tokens generated divided by simulation duration. Larger
                  batch sizes amortize weight bandwidth across more requests.
                </p>
              </div>

              <div className="space-y-1">
                <div className="font-semibold text-foreground">
                  GPU Slot Utilization
                </div>
                <code className="block bg-muted px-2 py-1 rounded text-[11px] font-mono text-foreground">
                  {simResult.formulaExplanation.utilizationFormula}
                </code>
                <p>
                  Fraction of total available decode slots actively generating
                  tokens rather than sitting idle waiting for a batch to end.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Navigation to Challenge */}
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
                Level 4 Challenge
              </h3>
              {isCompleted ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
                  Completed ✓
                </Badge>
              ) : (
                <Badge variant="secondary">2 Goals</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Demonstrate mastery of batching dynamics by meeting the latency
              SLO and showing continuous batching outperforming static batching.
            </p>
          </div>

          {/* Goal 1 Card */}
          <Card className={goal1Passed ? "border-emerald-500/40 bg-emerald-500/5" : ""}>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    goal1Passed
                      ? "bg-emerald-600 text-white"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {goal1Passed ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <Target className="size-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">
                      Goal 1: Reach ≥ 2,000 tokens/s while keeping p95 latency ≤ 2.0 s
                    </h4>
                    {goal1Passed ? (
                      <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4">
                        Passed ✓
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Adjust batch size and strategy until aggregate throughput
                    hits at least 2,000 tokens/s without breaching the 2.0s
                    p95 latency SLO.
                  </p>
                  <div className="pt-1 flex items-center gap-3 text-xs font-mono">
                    <span
                      className={
                        simResult.tokensPerSecond >= TARGET_THROUGHPUT
                          ? "text-emerald-700 dark:text-emerald-400 font-bold"
                          : "text-muted-foreground"
                      }
                    >
                      Throughput: {simResult.tokensPerSecond} / 2,000 tokens/s
                    </span>
                    <span>•</span>
                    <span
                      className={
                        simResult.p95LatencySec <= LATENCY_SLO_SEC
                          ? "text-emerald-700 dark:text-emerald-400 font-bold"
                          : "text-destructive font-bold"
                      }
                    >
                      p95: {simResult.p95LatencySec.toFixed(2)}s / 2.0s SLO
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Goal 2 Card */}
          <Card className={goal2Passed ? "border-emerald-500/40 bg-emerald-500/5" : ""}>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    goal2Passed
                      ? "bg-emerald-600 text-white"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {goal2Passed ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <Target className="size-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">
                      Goal 2: Show that continuous batching beats static at the same batch size
                    </h4>
                    {goal2Passed ? (
                      <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4">
                        Passed ✓
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Run the simulation in both Static and Continuous mode at
                    the same batch size to confirm that continuous batching
                    delivers higher throughput.
                  </p>

                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRunComparison}
                      className="text-xs h-7 gap-1"
                    >
                      <Zap className="size-3 text-primary" />
                      <span>Compare modes at batch size {batchSize}</span>
                    </Button>

                    {comparison?.static !== undefined &&
                      comparison?.continuous !== undefined && (
                        <span className="text-xs font-mono text-muted-foreground">
                          Static: {comparison.static} tok/s vs Continuous:{" "}
                          {comparison.continuous} tok/s (
                          <strong className="text-emerald-700 dark:text-emerald-400">
                            +
                            {Math.round(
                              ((comparison.continuous - comparison.static) /
                                comparison.static) *
                                100
                            )}
                            %
                          </strong>
                          )
                        </span>
                      )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completion Action */}
          <div className="pt-2">
            <Button
              onClick={onComplete}
              disabled={isCompleted || !allGoalsMet}
              className="gap-2"
              variant={isCompleted ? "secondary" : "default"}
            >
              {isCompleted ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>Challenge Completed ✓</span>
                </>
              ) : allGoalsMet ? (
                <>
                  <Sparkles className="size-4" />
                  <span>Complete Level 4 Challenge</span>
                </>
              ) : (
                <span>Complete both goals to pass</span>
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
              Here is what you learned in Level 4:
            </p>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>The Batching Trade-off:</strong> Bigger batches
                dramatically increase aggregate throughput by amortizing memory
                bandwidth costs, but increase step latency and queue waiting
                time.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Continuous Batching Eliminates Idle Gaps:</strong>{" "}
                Static batching leaves GPU slots empty whenever a short request
                finishes before its peers. Continuous (iteration-level)
                batching refills slots at every single token step.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>The SLO Decides Your Batch Size:</strong> You cannot
                increase batch size indefinitely. Your latency Service Level
                Objective (SLO) sets the hard ceiling on batch size.
              </span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Rough estimates for learning, not benchmarks. 1 GB = 10⁹ bytes.
          </p>

          <div className="flex justify-start pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setActiveSection("try")}
            >
              Back to Sandbox
            </Button>
          </div>
        </div>
      </LevelSectionContent>
    </div>
  )
}
