import * as React from "react"
import {
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Dices,
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
import {
  DEFAULT_CANDIDATE_TOKENS,
  PROMPT_TEXT,
  computeSamplingDistribution,
  sampleN,
  type SamplingTokenResult,
} from "@/lib/sampling"

export function Level1Component({ onComplete }: LevelProps) {
  const { setActiveSection, isCompleted } = useLevelLayout()

  // Sampling parameters
  const [temperature, setTemperature] = React.useState<number>(1.0)
  const [topK, setTopK] = React.useState<number>(8)
  const [topP, setTopP] = React.useState<number>(1.0)

  // Sampled output tokens from the latest "Sample 20x" run
  const [sampledTokens, setSampledTokens] = React.useState<string[]>([])

  // Challenge goal completion states
  const [goal1Passed, setGoal1Passed] = React.useState<boolean>(isCompleted)
  const [goal2Passed, setGoal2Passed] = React.useState<boolean>(isCompleted)

  const isGoal1Effective = goal1Passed || isCompleted
  const isGoal2Effective = goal2Passed || isCompleted
  const isChallengeCompleted = (goal1Passed && goal2Passed) || isCompleted

  // Compute live distribution
  const distribution: SamplingTokenResult[] = React.useMemo(() => {
    return computeSamplingDistribution(DEFAULT_CANDIDATE_TOKENS, {
      temperature,
      topK,
      topP,
    })
  }, [temperature, topK, topP])

  // Count frequencies of sampled tokens
  const tokenCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    sampledTokens.forEach((token) => {
      counts.set(token, (counts.get(token) ?? 0) + 1)
    })
    return counts
  }, [sampledTokens])

  const uniqueTokensCount = tokenCounts.size

  // Sample 20x handler
  const handleSample20 = React.useCallback(() => {
    const finalProbs = distribution.map((d) => d.finalProb)
    const samples = sampleN(finalProbs, 20).map((idx) => distribution[idx].token)

    setSampledTokens(samples)

    // Evaluate Goal 1: All 20 samples are "Paris"
    const isGoal1 =
      samples.length === 20 && samples.every((token) => token === "Paris")
    if (isGoal1) {
      setGoal1Passed(true)
    }

    // Evaluate Goal 2: At least 4 distinct tokens, and NO token has original probability < 5%
    const uniqueTokens = new Set(samples)
    const originalProbMap = new Map(
      distribution.map((d) => [d.token, d.originalProb])
    )
    const hasLowProbToken = samples.some(
      (token) => (originalProbMap.get(token) ?? 0) < 0.05
    )
    const isGoal2 =
      samples.length === 20 && uniqueTokens.size >= 4 && !hasLowProbToken

    if (isGoal2) {
      setGoal2Passed(true)
    }
  }, [distribution])

  // Trigger onComplete when both goals are met
  React.useEffect(() => {
    if (goal1Passed && goal2Passed && !isCompleted) {
      onComplete()
    }
  }, [goal1Passed, goal2Passed, isCompleted, onComplete])

  const handleResetControls = () => {
    setTemperature(1.0)
    setTopK(8)
    setTopP(1.0)
  }

  return (
    <div className="space-y-6">
      {/* 1. LEARN SECTION */}
      <LevelSectionContent section="learn">
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight">
              How LLMs Pick Tokens: Logits, Softmax & Sampling
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              An LLM does not generate text by choosing words directly. Instead,
              it computes a raw score called a <strong>logit</strong> for every
              word in its vocabulary. The <strong>softmax</strong> formula turns
              these raw scores into probabilities that sum to 100%, and{" "}
              <strong>sampling</strong> rolls a weighted die to select the next
              token.
            </p>
          </div>

          {/* Conceptual Flow Diagram */}
          <Card className="bg-muted/30 border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart2 className="size-4 text-primary" />
                <span>The Token Selection Pipeline</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                <div className="p-3 rounded-md bg-card border space-y-1.5">
                  <div className="font-semibold text-primary">1. Logits</div>
                  <p className="text-muted-foreground">
                    Raw, unnormalized numerical scores assigned to each candidate
                    token. Higher score = higher model preference.
                  </p>
                  <div className="font-mono text-[11px] bg-muted/50 p-1.5 rounded">
                    Paris: +2.4
                    <br />
                    Lyon: +1.6
                    <br />
                    the: +0.5
                  </div>
                </div>

                <div className="p-3 rounded-md bg-card border space-y-1.5">
                  <div className="font-semibold text-primary">
                    2. Softmax & Temperature
                  </div>
                  <p className="text-muted-foreground">
                    Exponentials turn logits into percentages summing to 1.0.
                    Temperature scales logits: low sharpens, high flattens.
                  </p>
                  <div className="font-mono text-[11px] bg-muted/50 p-1.5 rounded">
                    Paris: 50%
                    <br />
                    Lyon: 22%
                    <br />
                    the: 7%
                  </div>
                </div>

                <div className="p-3 rounded-md bg-card border space-y-1.5">
                  <div className="font-semibold text-primary">
                    3. Truncation & Sample
                  </div>
                  <p className="text-muted-foreground">
                    Top-k and top-p cut off low-probability tail tokens. A
                    random number picks from the remaining distribution.
                  </p>
                  <div className="font-mono text-[11px] bg-muted/50 p-1.5 rounded">
                    Top-K cuts tail →
                    <br />
                    Roll die →
                    <br />
                    Next token: Paris
                  </div>
                </div>
              </div>

              {/* Inline SVG illustration */}
              <div className="rounded-md border bg-card p-3 overflow-x-auto">
                <svg
                  viewBox="0 0 600 90"
                  className="w-full min-w-[360px] h-20 text-xs"
                  aria-label="Illustration showing logits transformed by softmax into probability distribution bars"
                  role="img"
                >
                  {/* Logits box */}
                  <rect
                    x="10"
                    y="10"
                    width="140"
                    height="70"
                    rx="6"
                    className="fill-muted/60 stroke-border"
                  />
                  <text
                    x="80"
                    y="32"
                    textAnchor="middle"
                    className="fill-foreground font-semibold"
                  >
                    Raw Logits
                  </text>
                  <text
                    x="80"
                    y="52"
                    textAnchor="middle"
                    className="fill-muted-foreground text-[10px]"
                  >
                    [-2.2 to +2.4]
                  </text>

                  {/* Arrow 1 */}
                  <path
                    d="M 160 45 L 210 45 M 200 38 L 210 45 L 200 52"
                    className="stroke-primary fill-none stroke-2"
                  />
                  <text
                    x="185"
                    y="35"
                    textAnchor="middle"
                    className="fill-primary text-[9px] font-mono"
                  >
                    Softmax
                  </text>

                  {/* Probability distribution bars */}
                  <rect
                    x="220"
                    y="10"
                    width="190"
                    height="70"
                    rx="6"
                    className="fill-muted/60 stroke-border"
                  />
                  <text
                    x="315"
                    y="25"
                    textAnchor="middle"
                    className="fill-foreground font-semibold"
                  >
                    Probabilities (sum = 1)
                  </text>
                  {/* mini bars */}
                  <rect
                    x="235"
                    y="32"
                    width="80"
                    height="8"
                    rx="2"
                    className="fill-primary"
                  />
                  <rect
                    x="235"
                    y="43"
                    width="40"
                    height="8"
                    rx="2"
                    className="fill-primary/70"
                  />
                  <rect
                    x="235"
                    y="54"
                    width="22"
                    height="8"
                    rx="2"
                    className="fill-primary/50"
                  />
                  <rect
                    x="235"
                    y="65"
                    width="10"
                    height="8"
                    rx="2"
                    className="fill-primary/30"
                  />

                  {/* Arrow 2 */}
                  <path
                    d="M 420 45 L 465 45 M 455 38 L 465 45 L 455 52"
                    className="stroke-primary fill-none stroke-2"
                  />
                  <text
                    x="442"
                    y="35"
                    textAnchor="middle"
                    className="fill-primary text-[9px] font-mono"
                  >
                    Sample
                  </text>

                  {/* Output token box */}
                  <rect
                    x="475"
                    y="10"
                    width="115"
                    height="70"
                    rx="6"
                    className="fill-primary/10 stroke-primary/30"
                  />
                  <text
                    x="532"
                    y="32"
                    textAnchor="middle"
                    className="fill-primary font-semibold"
                  >
                    Chosen Token
                  </text>
                  <text
                    x="532"
                    y="55"
                    textAnchor="middle"
                    className="fill-foreground font-bold font-mono text-sm"
                  >
                    &quot;Paris&quot;
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
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">
              Interactive Sampling Sandbox
            </h3>
            <p className="text-muted-foreground text-sm">
              Adjust temperature, top-k, and top-p to reshape how the model
              completes:{" "}
              <strong className="text-foreground">&quot;{PROMPT_TEXT}&quot;</strong>
            </p>
          </div>

          {/* Interactive controls */}
          <Card className="bg-muted/20 border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  Sampling Hyperparameters
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetControls}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3" />
                  <span>Reset defaults</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                {/* Temperature slider */}
                <div className="space-y-2 p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between">
                    <Label
                      id="temperature-label"
                      htmlFor="temperature-slider"
                      className="text-xs font-semibold"
                    >
                      Temperature (T)
                    </Label>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {temperature.toFixed(1)}
                    </Badge>
                  </div>
                  <input
                    id="temperature-slider"
                    type="range"
                    min={0.0}
                    max={2.0}
                    step={0.1}
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full cursor-pointer accent-primary"
                    aria-labelledby="temperature-label"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>0.0 (Greedy)</span>
                    <span>1.0 (Standard)</span>
                    <span>2.0 (Hot)</span>
                  </div>
                </div>

                {/* Top-K slider */}
                <div className="space-y-2 p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between">
                    <Label
                      id="top-k-label"
                      htmlFor="top-k-slider"
                      className="text-xs font-semibold"
                    >
                      Top-K
                    </Label>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {topK}
                    </Badge>
                  </div>
                  <input
                    id="top-k-slider"
                    type="range"
                    min={1}
                    max={8}
                    step={1}
                    value={topK}
                    onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                    className="w-full cursor-pointer accent-primary"
                    aria-labelledby="top-k-label"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>1 (Top only)</span>
                    <span>4 (Top half)</span>
                    <span>8 (All)</span>
                  </div>
                </div>

                {/* Top-P slider */}
                <div className="space-y-2 p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between">
                    <Label
                      id="top-p-label"
                      htmlFor="top-p-slider"
                      className="text-xs font-semibold"
                    >
                      Top-P (Nucleus)
                    </Label>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {topP.toFixed(2)}
                    </Badge>
                  </div>
                  <input
                    id="top-p-slider"
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={topP}
                    onChange={(e) => setTopP(parseFloat(e.target.value))}
                    className="w-full cursor-pointer accent-primary"
                    aria-labelledby="top-p-label"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>0.1 (Strict)</span>
                    <span>0.5 (Median)</span>
                    <span>1.0 (Full mass)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live probability bar chart */}
          <Card className="border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart2 className="size-4 text-primary" />
                  <span>Candidate Token Probabilities</span>
                </CardTitle>
                <div className="text-xs text-muted-foreground font-mono">
                  {distribution.filter((d) => !d.isCutOff).length} active /{" "}
                  {distribution.length} total
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div
                role="list"
                aria-label="Candidate token probability distribution"
                className="space-y-2"
              >
                {distribution.map((item) => {
                  const percentage = (item.finalProb * 100).toFixed(1)
                  return (
                    <div
                      key={item.token}
                      role="listitem"
                      data-token={item.token}
                      data-cutoff={item.isCutOff ? "true" : "false"}
                      className={`p-2 rounded-md border text-xs transition-opacity ${
                        item.isCutOff
                          ? "opacity-40 bg-muted/10 border-dashed"
                          : "bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold ${
                              item.isCutOff
                                ? "text-muted-foreground line-through"
                                : "text-foreground"
                            }`}
                          >
                            &quot;{item.token}&quot;
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            (logit: {item.logit > 0 ? `+${item.logit}` : item.logit})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 font-mono">
                          {item.isCutOff ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 text-muted-foreground"
                            >
                              Cut off
                            </Badge>
                          ) : (
                            <span className="font-semibold text-primary">
                              {percentage}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bar indicator */}
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-150 ${
                            item.isCutOff ? "bg-muted-foreground/30" : "bg-primary"
                          }`}
                          style={{
                            width: `${Math.max(0, item.finalProb * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Sample 20x Button & Results */}
          <Card className="border bg-muted/20">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Dices className="size-4 text-primary" />
                  <span>Sample Generated Tokens (20×)</span>
                </CardTitle>
                <Button onClick={handleSample20} className="gap-2" size="sm">
                  <Zap className="size-4" />
                  <span>Sample 20×</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {sampledTokens.length > 0 ? (
                <div className="space-y-3">
                  {/* Chips of sampled tokens */}
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Sampled sequence (20 tokens):
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-2 rounded-md bg-card border max-h-32 overflow-y-auto">
                      {sampledTokens.map((token, idx) => (
                        <Badge
                          key={`${token}-${idx}`}
                          variant={token === "Paris" ? "default" : "secondary"}
                          className="font-mono text-xs"
                        >
                          {token}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Summary counts */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold">Distribution counts:</span>
                      <span className="font-mono">
                        {uniqueTokensCount} distinct token
                        {uniqueTokensCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {Array.from(tokenCounts.entries()).map(([tok, count]) => (
                        <div
                          key={tok}
                          className="px-2 py-1 rounded bg-card border font-mono text-[11px] flex items-center gap-1.5"
                        >
                          <span className="font-semibold">{tok}:</span>
                          <span className="text-primary font-bold">
                            {count}×
                          </span>
                          <span className="text-muted-foreground">
                            ({Math.round((count / 20) * 100)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic py-2">
                  Click &quot;Sample 20×&quot; to roll weighted dice and observe
                  which tokens get picked under current temperature, top-k, and
                  top-p settings.
                </div>
              )}
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

      {/* 3. CHALLENGE SECTION */}
      <LevelSectionContent section="challenge">
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight">
                Level 1 Challenge: Taming the Tail
              </h3>
              {isChallengeCompleted ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
                  Completed ✓
                </Badge>
              ) : (
                <Badge variant="secondary">In Progress</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Adjust sampling parameters and sample 20 tokens to meet both
              objectives below.
            </p>
          </div>

          {/* Goal 1 Card */}
          <Card
            className={
              isGoal1Effective
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "bg-card border"
            }
          >
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full mt-0.5 ${
                      isGoal1Effective
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isGoal1Effective ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <Target className="size-4" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-semibold">
                      Goal 1: Deterministic Output
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Make it answer <strong>Paris</strong> 20 out of 20 times.
                    </p>
                  </div>
                </div>

                <Badge
                  variant={isGoal1Effective ? "default" : "outline"}
                  className={
                    isGoal1Effective
                      ? "bg-emerald-600 hover:bg-emerald-600 text-white text-xs"
                      : "text-muted-foreground text-xs"
                  }
                >
                  {isGoal1Effective ? "Passed ✓" : "Pending"}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground pl-8">
                {isGoal1Effective ? (
                  <span className="text-emerald-600 font-medium">
                    ✓ Goal met! Paris answered 20/20 times.
                  </span>
                ) : (
                  <span>
                    Hint: Low temperature (e.g. 0.0) or Top-K = 1 forces greedy
                    argmax decoding.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Goal 2 Card */}
          <Card
            className={
              isGoal2Effective
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "bg-card border"
            }
          >
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full mt-0.5 ${
                      isGoal2Effective
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isGoal2Effective ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <Target className="size-4" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-semibold">
                      Goal 2: Safe Diversity
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Get at least 4 different tokens in 20 samples, but never a
                      token below 5% original probability.
                    </p>
                  </div>
                </div>

                <Badge
                  variant={isGoal2Effective ? "default" : "outline"}
                  className={
                    isGoal2Effective
                      ? "bg-emerald-600 hover:bg-emerald-600 text-white text-xs"
                      : "text-muted-foreground text-xs"
                  }
                >
                  {isGoal2Effective ? "Passed ✓" : "Pending"}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground pl-8">
                {isGoal2Effective ? (
                  <span className="text-emerald-600 font-medium">
                    ✓ Goal met! Sampled at least 4 distinct tokens without
                    picking low-probability tail tokens.
                  </span>
                ) : (
                  <span>
                    Hint: Raise temperature (e.g. 1.4) for variety, but restrict
                    Top-K (≤ 4) or Top-P (≤ 0.92) to prune tail tokens (&quot;a&quot;,
                    &quot;located&quot;, &quot;beautiful&quot;, &quot;known&quot;).
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sampling Action in Challenge */}
          <Card className="border bg-muted/20">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Current Settings & Test
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-mono">
                    T={temperature.toFixed(1)}, Top-K={topK}, Top-P=
                    {topP.toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSample20}
                    className="gap-1.5"
                    size="sm"
                  >
                    <Dices className="size-4" />
                    <span>Sample 20× & Test Goals</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {sampledTokens.length > 0 ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between font-mono text-muted-foreground">
                    <span>
                      Latest batch: {uniqueTokensCount} unique token
                      {uniqueTokensCount === 1 ? "" : "s"}
                    </span>
                    <span>
                      Paris count: {tokenCounts.get("Paris") ?? 0}/20
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 p-2 rounded bg-card border max-h-24 overflow-y-auto">
                    {sampledTokens.map((t, i) => (
                      <Badge
                        key={`${t}-${i}`}
                        variant={t === "Paris" ? "default" : "secondary"}
                        className="text-[11px] font-mono py-0 px-1.5"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic py-2">
                  Click &quot;Sample 20× &amp; Test Goals&quot; to test your
                  current temperature, top-k, and top-p settings against the
                  challenge objectives.
                </div>
              )}

              {isChallengeCompleted && (
                <div
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400"
                >
                  <Sparkles className="size-4 shrink-0 text-emerald-600" />
                  <span>
                    <strong>Level 1 Mastered!</strong> Both goals achieved.
                    Your completion has been recorded.
                  </span>
                </div>
              )}
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
              Here is what you learned in Level 1:
            </p>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Temperature → 0 is greedy decoding:</strong> At zero
                temperature, the model deterministically selects the single
                highest-probability token every time. Higher temperatures flatten
                the distribution to encourage diverse expressions.
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Top-P (nucleus sampling) covers probability mass:</strong>{" "}
                Unlike fixed Top-K, Top-P dynamically keeps the smallest subset
                of tokens covering probability mass <em>p</em>. It expands when
                the model is uncertain and contracts when confident.
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Creativity vs. reliability is a sampling choice:</strong>{" "}
                The model&apos;s weights and raw logits never change between
                prompts; your choice of temperature and cutoff thresholds
                dictates whether outputs are strictly factual or creatively
                imaginative.
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
                Level 1 Complete
              </Badge>
            </div>
          </div>
        </div>
      </LevelSectionContent>
    </div>
  )
}
