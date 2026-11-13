import * as React from "react"
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  Server,
  Users,
} from "lucide-react"

import {
  calculateWeightMemory,
  calculateKvCachePerToken,
  calculateFreeMemoryForKv,
  calculateKvCapacity,
  calculateMaxConcurrency,
  evaluateMemoryFit,
  MODEL_PRESETS,
  GPU_PRESETS,
  CONTEXT_LENGTH_PRESETS,
  BYTES_PER_PARAM,
  BYTES_PER_KV_ELEMENT,
  BYTES_IN_GB,
  BYTES_IN_KB,
  type WeightPrecision,
  type KvPrecision,
} from "@/lib/model"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const MODEL_PRESET_ITEMS: Record<string, string> = {
  "llama-3-8b": "Llama-3-8B (8B, 32L, 8KV, 128D)",
  "llama-3-70b": "Llama-3-70B (70B, 80L, 8KV, 128D)",
  custom: "Custom Dimensions",
}

const GPU_PRESET_ITEMS: Record<string, string> = {
  "a100-80gb": "NVIDIA A100 80GB",
  "h100-80gb": "NVIDIA H100 80GB",
  "l40s-48gb": "NVIDIA L40S 48GB",
  custom: "Custom Memory",
}

export function CalculatorPage() {
  // Model state
  const [modelPreset, setModelPreset] = React.useState<string>("llama-3-8b")
  const [paramsBillions, setParamsBillions] = React.useState<number>(8)
  const [layers, setLayers] = React.useState<number>(32)
  const [kvHeads, setKvHeads] = React.useState<number>(8)
  const [headDim, setHeadDim] = React.useState<number>(128)

  // Precision state
  const [weightPrecision, setWeightPrecision] =
    React.useState<WeightPrecision>("FP16")
  const [kvPrecision, setKvPrecision] = React.useState<KvPrecision>("FP16")

  // GPU state
  const [gpuPreset, setGpuPreset] = React.useState<string>("a100-80gb")
  const [gpuMemoryGb, setGpuMemoryGb] = React.useState<number>(80)
  const [gpuCount, setGpuCount] = React.useState<number>(1)

  // Workload state
  const [contextPreset, setContextPreset] = React.useState<string>("4k")
  const [contextLength, setContextLength] = React.useState<number>(4096)
  const [customContextInput, setCustomContextInput] =
    React.useState<string>("4096")
  const [contextError, setContextError] = React.useState<string | null>(null)
  const [overheadGb, setOverheadGb] = React.useState<number>(8) // default 10% of 1x80GB

  // Handle Model Preset selection
  const handleModelPresetChange = (presetId: string | null) => {
    if (!presetId) return
    setModelPreset(presetId)
    const preset = MODEL_PRESETS.find((p) => p.id === presetId)
    if (preset) {
      setParamsBillions(preset.parametersBillions)
      setLayers(preset.layers)
      setKvHeads(preset.kvHeads)
      setHeadDim(preset.headDim)
    }
  }

  // Handle GPU Preset selection
  const handleGpuPresetChange = (presetId: string | null) => {
    if (!presetId) return
    setGpuPreset(presetId)
    const preset = GPU_PRESETS.find((p) => p.id === presetId)
    if (preset) {
      setGpuMemoryGb(preset.memoryGb)
      setOverheadGb(Number(((preset.memoryGb * gpuCount) * 0.1).toFixed(1)))
    }
  }

  // Handle GPU count change
  const handleGpuCountChange = (count: number) => {
    const validCount = Math.min(8, Math.max(1, count || 1))
    setGpuCount(validCount)
    setOverheadGb(Number(((gpuMemoryGb * validCount) * 0.1).toFixed(1)))
  }

  // Handle Context Length Preset selection
  const handleContextPresetChange = (presetId: string) => {
    if (!presetId) return
    setContextPreset(presetId)
    if (presetId === "custom") {
      const val = parseInt(customContextInput, 10)
      if (isNaN(val) || val <= 0) {
        setContextError("Context length must be greater than 0")
        setContextLength(0)
      } else {
        setContextError(null)
        setContextLength(val)
      }
    } else {
      setContextError(null)
      const preset = CONTEXT_LENGTH_PRESETS.find((p) => p.id === presetId)
      if (preset) {
        setContextLength(preset.tokens)
        setCustomContextInput(String(preset.tokens))
      }
    }
  }

  // Handle Custom Context Length input change
  const handleCustomContextChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const raw = e.target.value
    setCustomContextInput(raw)
    const val = parseInt(raw, 10)
    if (isNaN(val) || val <= 0) {
      setContextError("Context length must be greater than 0")
      setContextLength(0)
    } else {
      setContextError(null)
      setContextLength(val)
    }
  }

  // Calculated values from model.ts formulas
  const rawParams = Math.max(0, paramsBillions) * 1e9
  const totalGpuMemoryBytes = Math.max(0, gpuMemoryGb) * Math.max(1, gpuCount) * BYTES_IN_GB
  const overheadBytes = Math.max(0, overheadGb) * BYTES_IN_GB

  // 1. Weight memory
  const weightMemoryBytes = calculateWeightMemory(rawParams, weightPrecision)
  const weightMemoryGb = weightMemoryBytes / BYTES_IN_GB

  // 2. KV cache per token
  const kvCachePerTokenBytes = calculateKvCachePerToken(
    Math.max(0, layers),
    Math.max(0, kvHeads),
    Math.max(0, headDim),
    kvPrecision
  )
  const kvCachePerTokenKb = kvCachePerTokenBytes / BYTES_IN_KB

  // 3. Free memory for KV cache
  const freeMemoryBytes = calculateFreeMemoryForKv(
    totalGpuMemoryBytes,
    weightMemoryBytes,
    overheadBytes
  )
  const freeMemoryGb = freeMemoryBytes / BYTES_IN_GB

  // 4. KV capacity
  const kvCapacityTokens = calculateKvCapacity(
    freeMemoryBytes,
    kvCachePerTokenBytes
  )

  // 5. Max concurrent requests
  const maxConcurrency = calculateMaxConcurrency(
    kvCapacityTokens,
    contextLength
  )

  // 6. Memory fit evaluation
  const fitResult = evaluateMemoryFit({
    parameters: rawParams,
    precision: weightPrecision,
    totalGpuMemoryBytes,
    overheadBytes,
  })

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      {/* Main Grid: Inputs on Left/Top, Outputs on Right/Bottom */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* INPUTS SECTION */}
        <div className="space-y-6 lg:col-span-5">
          {/* Model Specification Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="size-4" />
                Model Configuration
              </CardTitle>
              <CardDescription>
                Choose an architecture preset or enter custom dimensions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="model-preset">Model Preset</Label>
                <Select
                  value={modelPreset}
                  onValueChange={handleModelPresetChange}
                  items={MODEL_PRESET_ITEMS}
                >
                  <SelectTrigger id="model-preset" className="w-full">
                    <SelectValue placeholder="Select a preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MODEL_PRESET_ITEMS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {modelPreset === "custom" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="params">Parameters (Billions)</Label>
                      <Input
                        id="params"
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={paramsBillions}
                        onChange={(e) => {
                          setParamsBillions(parseFloat(e.target.value) || 0)
                          setModelPreset("custom")
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="layers">Layers</Label>
                      <Input
                        id="layers"
                        type="number"
                        min={1}
                        step={1}
                        value={layers}
                        onChange={(e) => {
                          setLayers(parseInt(e.target.value, 10) || 0)
                          setModelPreset("custom")
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="kv-heads">KV Heads</Label>
                      <Input
                        id="kv-heads"
                        type="number"
                        min={1}
                        step={1}
                        value={kvHeads}
                        onChange={(e) => {
                          setKvHeads(parseInt(e.target.value, 10) || 0)
                          setModelPreset("custom")
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="head-dim">Head Dimension</Label>
                      <Input
                        id="head-dim"
                        type="number"
                        min={1}
                        step={1}
                        value={headDim}
                        onChange={(e) => {
                          setHeadDim(parseInt(e.target.value, 10) || 0)
                          setModelPreset("custom")
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                  {paramsBillions}B params · {layers} layers · {kvHeads} KV heads · head dim {headDim}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="weight-prec">Weight Precision</Label>
                  <Select
                    value={weightPrecision}
                    onValueChange={(val) =>
                      val && setWeightPrecision(val as WeightPrecision)
                    }
                  >
                    <SelectTrigger id="weight-prec" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FP16">FP16 (2 bytes)</SelectItem>
                      <SelectItem value="FP8">FP8 (1 byte)</SelectItem>
                      <SelectItem value="INT4">INT4 (0.5 byte)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kv-prec">KV Cache Precision</Label>
                  <Select
                    value={kvPrecision}
                    onValueChange={(val) =>
                      val && setKvPrecision(val as KvPrecision)
                    }
                  >
                    <SelectTrigger id="kv-prec" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FP16">FP16 (2 bytes)</SelectItem>
                      <SelectItem value="FP8">FP8 (1 byte)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hardware & Workload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="size-4" />
                Hardware & Workload
              </CardTitle>
              <CardDescription>
                Configure GPU capacity, count, and request context length.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="gpu-preset">GPU Preset</Label>
                <Select
                  value={gpuPreset}
                  onValueChange={handleGpuPresetChange}
                  items={GPU_PRESET_ITEMS}
                >
                  <SelectTrigger id="gpu-preset" className="w-full">
                    <SelectValue placeholder="Select GPU preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GPU_PRESET_ITEMS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gpu-mem">Memory per GPU (GB)</Label>
                  <Input
                    id="gpu-mem"
                    type="number"
                    min={1}
                    value={gpuMemoryGb}
                    onChange={(e) => {
                      const mem = parseFloat(e.target.value) || 0
                      setGpuMemoryGb(mem)
                      setGpuPreset("custom")
                      setOverheadGb(Number(((mem * gpuCount) * 0.1).toFixed(1)))
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label id="gpu-count-label" htmlFor="gpu-count">
                    Number of GPUs
                  </Label>
                  <ToggleGroup
                    id="gpu-count"
                    aria-labelledby="gpu-count-label"
                    type="single"
                    value={String(gpuCount)}
                    onValueChange={(val: string) => {
                      if (val) {
                        handleGpuCountChange(parseInt(val, 10))
                      }
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

              <div className="space-y-2">
                <Label id="context-preset-label" htmlFor="context-preset">
                  Context Length
                </Label>
                <ToggleGroup
                  id="context-preset"
                  aria-labelledby="context-preset-label"
                  type="single"
                  value={contextPreset}
                  onValueChange={handleContextPresetChange}
                  variant="outline"
                  className="flex flex-wrap gap-1"
                >
                  {CONTEXT_LENGTH_PRESETS.map((p) => (
                    <ToggleGroupItem
                      key={p.id}
                      value={p.id}
                    >
                      {p.label}
                    </ToggleGroupItem>
                  ))}
                  <ToggleGroupItem value="custom">
                    Custom
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {contextPreset === "custom" && (
                <div className="space-y-1.5">
                  <Label htmlFor="context-len">Context Length (Tokens)</Label>
                  <Input
                    id="context-len"
                    type="number"
                    min={1}
                    step={256}
                    value={customContextInput}
                    aria-invalid={contextError !== null}
                    aria-describedby={
                      contextError ? "context-len-error" : undefined
                    }
                    onChange={handleCustomContextChange}
                  />
                  {contextError && (
                    <p
                      id="context-len-error"
                      className="text-xs text-destructive font-medium"
                      role="alert"
                    >
                      {contextError}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="overhead-gb">Runtime Overhead (GB)</Label>
                <Input
                  id="overhead-gb"
                  type="number"
                  min={0}
                  step={0.5}
                  value={overheadGb}
                  aria-describedby="overhead-gb-help"
                  onChange={(e) =>
                    setOverheadGb(parseFloat(e.target.value) || 0)
                  }
                />
                <p
                  id="overhead-gb-help"
                  className="text-[11px] text-muted-foreground"
                >
                  Default is 10% of total GPU memory.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* OUTPUTS SECTION */}
        <div className="space-y-4 lg:col-span-7">
          {/* HERO RESULT PANEL */}
          <Card
            data-testid="hero-result-panel"
            className={cn(
              "overflow-hidden border-2 shadow-sm transition-colors",
              fitResult.fits
                ? "border-emerald-500/30 bg-emerald-500/[0.04] dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]"
                : "border-destructive/30 bg-destructive/[0.04] dark:border-destructive/20 dark:bg-destructive/[0.06]"
            )}
          >
            <CardHeader className="p-4 sm:p-5 pb-3 sm:pb-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                {/* Verdict Section */}
                <div className="space-y-1.5 sm:max-w-[55%]">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Memory Fit Verdict
                  </div>
                  <div className="flex items-center gap-2">
                    {fitResult.fits ? (
                      <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="size-6 text-destructive shrink-0" />
                    )}
                    <span
                      className={cn(
                        "text-2xl sm:text-3xl font-bold tracking-tight",
                        fitResult.fits
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive"
                      )}
                    >
                      {fitResult.fits ? "Fits" : "Does Not Fit"}
                    </span>
                  </div>

                  {fitResult.fits ? (
                    <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
                      Model weights require {weightMemoryGb.toFixed(1)} GB out of{" "}
                      {(totalGpuMemoryBytes / BYTES_IN_GB).toFixed(1)} GB total GPU
                      memory, leaving {freeMemoryGb.toFixed(1)} GB for the KV cache
                      after {overheadGb.toFixed(1)} GB runtime overhead.
                    </p>
                  ) : (
                    <div className="space-y-1 pt-0.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs font-semibold px-2 py-0.5">
                          {fitResult.shortfallGb.toFixed(1)} GB Shortfall
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                        {fitResult.verdict}
                      </p>
                    </div>
                  )}
                </div>

                {/* Max Concurrent Requests Headline Section */}
                <div className="flex flex-col sm:items-end sm:text-right border-t pt-3 sm:border-t-0 sm:pt-0 border-border/60">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center sm:justify-end gap-1.5">
                    <Users className="size-3.5 text-muted-foreground" />
                    <span>Max Concurrent Requests</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 sm:justify-end mt-0.5">
                    <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                      {maxConcurrency.toLocaleString()}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      requests
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    @ {contextLength.toLocaleString()} tokens context
                  </div>
                </div>
              </div>
            </CardHeader>

            {/* Max Concurrency Formula Block */}
            <CardContent className="p-4 sm:p-5 pt-0 sm:pt-0">
              <div className="text-xs text-muted-foreground font-mono bg-muted/40 border border-border/50 p-2.5 rounded-md">
                <div className="text-[10px] text-muted-foreground uppercase font-sans mb-0.5 flex items-center justify-between">
                  <span>Formula: Max Concurrent Requests</span>
                  <span>floor(kv_capacity ÷ context_length)</span>
                </div>
                <div className="text-foreground text-[11px] font-mono mt-0.5">
                  floor({kvCapacityTokens.toLocaleString()} tokens ÷ {contextLength.toLocaleString()} tokens) = {maxConcurrency.toLocaleString()} requests
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Secondary Metrics Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Output 1: Weight Memory */}
            <Card className="bg-card/70 shadow-none border-border/70">
              <CardHeader className="p-3.5 pb-1.5">
                <CardDescription className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Weight Memory</span>
                  <HardDrive className="size-3.5 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="text-xl font-bold">
                  {weightMemoryGb.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">GB</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 space-y-1">
                <div className="text-xs text-muted-foreground font-mono bg-muted/40 p-2 rounded text-[11px]">
                  <div className="text-[10px] text-muted-foreground uppercase font-sans mb-0.5">Formula:</div>
                  <div>parameters × bytes_per_param</div>
                  <div className="text-foreground mt-0.5">
                    {paramsBillions}B × {BYTES_PER_PARAM[weightPrecision]} B = {weightMemoryGb.toFixed(1)} GB
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Output 2: KV Cache per Token */}
            <Card className="bg-card/70 shadow-none border-border/70">
              <CardHeader className="p-3.5 pb-1.5">
                <CardDescription className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>KV Cache per Token</span>
                  <Database className="size-3.5 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="text-xl font-bold">
                  {kvCachePerTokenKb.toFixed(2)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    KB [{kvCachePerTokenBytes.toLocaleString()} B]
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 space-y-1">
                <div className="text-xs text-muted-foreground font-mono bg-muted/40 p-2 rounded text-[11px]">
                  <div className="text-[10px] text-muted-foreground uppercase font-sans mb-0.5">Formula:</div>
                  <div>2 × layers × kv_heads × head_dim × bytes_per_element</div>
                  <div className="text-foreground mt-0.5">
                    2 × {layers} × {kvHeads} × {headDim} × {BYTES_PER_KV_ELEMENT[kvPrecision]} B = {kvCachePerTokenBytes.toLocaleString()} B ({kvCachePerTokenKb.toFixed(2)} KB)
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Output 3: Free Memory for KV Cache */}
            <Card className="bg-card/70 shadow-none border-border/70">
              <CardHeader className="p-3.5 pb-1.5">
                <CardDescription className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Free Memory for KV</span>
                  <Server className="size-3.5 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="text-xl font-bold">
                  {freeMemoryGb.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">GB</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 space-y-1">
                <div className="text-xs text-muted-foreground font-mono bg-muted/40 p-2 rounded text-[11px]">
                  <div className="text-[10px] text-muted-foreground uppercase font-sans mb-0.5">Formula:</div>
                  <div>(gpu_memory × gpus) − weight_memory − overhead</div>
                  <div className="text-foreground mt-0.5">
                    ({gpuMemoryGb} GB × {gpuCount}) − {weightMemoryGb.toFixed(1)} GB − {overheadGb.toFixed(1)} GB = {freeMemoryGb.toFixed(1)} GB
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Output 4: KV Capacity */}
            <Card className="bg-card/70 shadow-none border-border/70">
              <CardHeader className="p-3.5 pb-1.5">
                <CardDescription className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>KV Capacity</span>
                  <Cpu className="size-3.5 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="text-xl font-bold">
                  {kvCapacityTokens.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-muted-foreground">tokens</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 space-y-1">
                <div className="text-xs text-muted-foreground font-mono bg-muted/40 p-2 rounded text-[11px]">
                  <div className="text-[10px] text-muted-foreground uppercase font-sans mb-0.5">Formula:</div>
                  <div>free_memory ÷ kv_per_token</div>
                  <div className="text-foreground mt-0.5">
                    {freeMemoryGb.toFixed(1)} GB ÷ {kvCachePerTokenBytes.toLocaleString()} B = {kvCapacityTokens.toLocaleString()} tokens
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">
            Rough estimates for learning, not benchmarks. 1 GB = 10⁹ bytes.
          </p>
        </div>
      </div>
    </div>
  )
}
