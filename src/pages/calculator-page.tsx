import * as React from "react"
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Database,
  HardDrive,
  Info,
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
  BYTES_PER_PARAM,
  BYTES_PER_KV_ELEMENT,
  BYTES_IN_GB,
  BYTES_IN_KB,
  type WeightPrecision,
  type KvPrecision,
} from "@/lib/model"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  const [contextLength, setContextLength] = React.useState<number>(4096)
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
      {/* Estimation disclaimer note */}
      <Alert className="border-border bg-muted/30">
        <Info className="size-4 text-muted-foreground" />
        <AlertTitle className="text-sm font-medium">
          Estimates, not benchmarks
        </AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
          Results are rough ballparks. Real numbers depend on runtime framework
          overheads (vLLM, TensorRT-LLM), CUDA graph allocations, and kernel
          workspaces. Memory uses decimal gigabytes (1 GB = 1e9 bytes).
        </AlertDescription>
      </Alert>

      {/* Main Grid: Inputs on Left/Top, Outputs on Right/Bottom */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* INPUTS SECTION */}
        <div className="space-y-6 lg:col-span-5">
          {/* Model Specification Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="size-4" />
                  Model Configuration
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {modelPreset === "custom" ? "Custom" : "Preset"}
                </Badge>
              </div>
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
                  <Label htmlFor="gpu-count">Number of GPUs (1–8)</Label>
                  <Input
                    id="gpu-count"
                    type="number"
                    min={1}
                    max={8}
                    value={gpuCount}
                    onChange={(e) =>
                      handleGpuCountChange(parseInt(e.target.value, 10))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="context-len">Context Length (Tokens)</Label>
                  <Input
                    id="context-len"
                    type="number"
                    min={128}
                    step={256}
                    value={contextLength}
                    onChange={(e) =>
                      setContextLength(parseInt(e.target.value, 10) || 0)
                    }
                  />
                </div>
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
                  <p id="overhead-gb-help" className="text-[11px] text-muted-foreground">
                    Default is 10% of total GPU memory.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* OUTPUTS SECTION */}
        <div className="space-y-6 lg:col-span-7">
          {/* Fit / Verdict Banner */}
          {fitResult.fits ? (
            <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <AlertTitle className="font-semibold">Fits in Memory</AlertTitle>
              <AlertDescription className="text-xs">
                Model weights require {weightMemoryGb.toFixed(1)} GB out of{" "}
                {(totalGpuMemoryBytes / BYTES_IN_GB).toFixed(1)} GB total GPU
                memory, leaving {freeMemoryGb.toFixed(1)} GB for the KV cache
                after {overheadGb.toFixed(1)} GB runtime overhead.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle className="font-semibold">Does Not Fit</AlertTitle>
              <AlertDescription className="text-xs font-mono">
                {fitResult.verdict}
              </AlertDescription>
            </Alert>
          )}

          {/* Output Cards Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Output 1: Weight Memory */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Weight Memory</span>
                  <HardDrive className="size-3.5 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="text-2xl font-bold">
                  {weightMemoryGb.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">GB</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Collapsible>
                  <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer">
                    <span>How is this calculated?</span>
                    <ChevronDown className="size-3.5 transition-transform duration-200 group-data-[panel-open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded">
                      <div className="text-[10px] text-muted-foreground uppercase font-sans mb-0.5">Formula:</div>
                      <div>parameters × bytes_per_param</div>
                      <div className="text-foreground mt-1 text-[11px]">
                        {paramsBillions}B × {BYTES_PER_PARAM[weightPrecision]} B = {weightMemoryGb.toFixed(1)} GB
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            {/* Output 2: KV Cache per Token */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>KV Cache per Token</span>
                  <Database className="size-3.5 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="text-2xl font-bold">
                  {kvCachePerTokenKb.toFixed(2)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    KB [{kvCachePerTokenBytes.toLocaleString()} B]
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Collapsible>
                  <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer">
                    <span>How is this calculated?</span>
                    <ChevronDown className="size-3.5 transition-transform duration-200 group-data-[panel-open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded">
                      <div className="text-[10px] text-muted-foreground uppercase font-sans mb-0.5">Formula:</div>
                      <div>2 × layers × kv_heads × head_dim × bytes_per_element</div>
                      <div className="text-foreground mt-1 text-[11px]">
                        2 × {layers} × {kvHeads} × {headDim} × {BYTES_PER_KV_ELEMENT[kvPrecision]} B = {kvCachePerTokenBytes.toLocaleString()} B ({kvCachePerTokenKb.toFixed(2)} KB)
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            {/* Output 3: Free Memory for KV Cache */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Free Memory for KV</span>
                  <Server className="size-3.5 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="text-2xl font-bold">
                  {freeMemoryGb.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">GB</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Collapsible>
                  <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer">
                    <span>How is this calculated?</span>
                    <ChevronDown className="size-3.5 transition-transform duration-200 group-data-[panel-open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded">
                      <div className="text-[10px] text-muted-foreground uppercase font-sans mb-0.5">Formula:</div>
                      <div>(gpu_memory × gpus) − weight_memory − overhead</div>
                      <div className="text-foreground mt-1 text-[11px]">
                        ({gpuMemoryGb} GB × {gpuCount}) − {weightMemoryGb.toFixed(1)} GB − {overheadGb.toFixed(1)} GB = {freeMemoryGb.toFixed(1)} GB
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            {/* Output 4: KV Capacity */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>KV Capacity</span>
                  <Cpu className="size-3.5 text-muted-foreground" />
                </CardDescription>
                <CardTitle className="text-2xl font-bold">
                  {kvCapacityTokens.toLocaleString()}{" "}
                  <span className="text-sm font-normal text-muted-foreground">tokens</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Collapsible>
                  <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer">
                    <span>How is this calculated?</span>
                    <ChevronDown className="size-3.5 transition-transform duration-200 group-data-[panel-open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded">
                      <div className="text-[10px] text-muted-foreground uppercase font-sans mb-0.5">Formula:</div>
                      <div>free_memory ÷ kv_per_token</div>
                      <div className="text-foreground mt-1 text-[11px]">
                        ({freeMemoryGb.toFixed(1)} GB × 10⁹ B/GB) ÷ {kvCachePerTokenBytes.toLocaleString()} B = {kvCapacityTokens.toLocaleString()} tokens
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            {/* Output 5: Max Concurrent Requests */}
            <Card className="sm:col-span-2">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Max Concurrent Requests</span>
                  <Users className="size-3.5 text-muted-foreground" />
                </CardDescription>
                <div className="flex items-baseline gap-2">
                  <CardTitle className="text-3xl font-bold">
                    {maxConcurrency}
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    concurrent requests @ {contextLength.toLocaleString()} tokens/request
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Collapsible>
                  <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer">
                    <span>How is this calculated?</span>
                    <ChevronDown className="size-3.5 transition-transform duration-200 group-data-[panel-open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded">
                      <div className="text-[10px] text-muted-foreground uppercase font-sans mb-0.5">Formula:</div>
                      <div>floor(kv_capacity ÷ context_length)</div>
                      <div className="text-foreground mt-1 text-[11px]">
                        floor({kvCapacityTokens.toLocaleString()} tokens ÷ {contextLength.toLocaleString()} tokens) = {maxConcurrency} requests
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
