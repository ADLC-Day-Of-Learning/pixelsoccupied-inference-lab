import * as React from "react"
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Hash,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  tokenize,
  computeTokenizerStats,
  checkSentenceChallenge,
  checkWordChallenge,
  SAMPLE_PRESETS,
} from "@/lib/tokenizer"

/**
 * Color cycling classes for token chips in Try and Challenge views.
 * Designed for WCAG AA contrast in both light and dark themes.
 */
const TOKEN_COLOR_PALETTE = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
  "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
]

function getTokenColorClasses(index: number): string {
  return TOKEN_COLOR_PALETTE[index % TOKEN_COLOR_PALETTE.length]
}

interface TokenChipProps {
  text: string
  id: number
  index: number
}

function TokenChip({ text, id, index }: TokenChipProps) {
  const colorClass = getTokenColorClasses(index)
  const displayText = text
    .replace(/^ /, "␣")
    .replace(/\n/, "↵")
    .replace(/\t/, "⇥")

  return (
    <span
      data-testid={`token-chip-${index}`}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-xs font-medium border ${colorClass} transition-colors`}
    >
      <span className="whitespace-pre">{displayText}</span>
      <span className="text-[10px] opacity-70">#{id}</span>
    </span>
  )
}

export function TokensLevelComponent({ onComplete }: LevelProps) {
  const { setActiveSection, isCompleted } = useLevelLayout()

  // Try sandbox state
  const [tryText, setTryText] = React.useState(SAMPLE_PRESETS[0].text)

  // Challenge states
  const [challengeSentence, setChallengeSentence] = React.useState("")
  const [challengeWord, setChallengeWord] = React.useState("")

  // Tokenize Try text and compute live statistics
  const tryTokens = React.useMemo(() => tokenize(tryText), [tryText])
  const tryStats = React.useMemo(
    () => computeTokenizerStats(tryText),
    [tryText]
  )

  // Challenge evaluations using pure functions from src/lib/tokenizer.ts
  const sentenceResult = React.useMemo(
    () => checkSentenceChallenge(challengeSentence),
    [challengeSentence]
  )
  const sentenceTokens = React.useMemo(
    () => tokenize(challengeSentence.trim()),
    [challengeSentence]
  )

  const wordResult = React.useMemo(
    () => checkWordChallenge(challengeWord),
    [challengeWord]
  )
  const wordTokens = React.useMemo(
    () => tokenize(challengeWord.trim()),
    [challengeWord]
  )

  const bothChallengesPassed = sentenceResult.passes && wordResult.passes

  // Automatically trigger completion when both challenge goals are met
  React.useEffect(() => {
    if (bothChallengesPassed && !isCompleted) {
      onComplete()
    }
  }, [bothChallengesPassed, isCompleted, onComplete])

  return (
    <div className="space-y-6">
      {/* 1. LEARN SECTION */}
      <LevelSectionContent section="learn">
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight">
              Tokens: What the Model Actually Reads
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Large language models do not read raw words or individual letters.
              Instead, they process text as <strong>tokens</strong>: chunks of
              text (frequent words or subword pieces) mapped to integer IDs.
              Every cost in inference—prompt length, KV cache memory, step
              latency, and price—is counted in tokens.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Before reaching model weights, text passes through a deterministic{" "}
              <strong>tokenizer</strong> that converts characters into numeric
              token IDs. A helpful rule of thumb for English text is roughly{" "}
              <strong className="text-foreground">~4 characters</strong> or{" "}
              <strong className="text-foreground">~0.75 words</strong> per
              token.
            </p>
          </div>

          {/* Learn Diagram: Text -> Chunks -> IDs -> Model -> Next Token ID -> Text */}
          <Card className="bg-muted/30 border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="size-4 text-primary" aria-hidden="true" />
                <span>The Tokenization Pipeline</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* 1. Input string */}
                <div className="flex flex-col items-center rounded-md border bg-card p-2.5 shadow-2xs min-w-[120px]">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">
                    Input Text
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    &quot;Inference is fun!&quot;
                  </span>
                </div>

                <ArrowRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />

                {/* 2. Token chunks */}
                <div className="flex flex-col items-center rounded-md border bg-card p-2.5 shadow-2xs">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">
                    Token Chunks
                  </span>
                  <div className="flex flex-wrap gap-1 justify-center">
                    <span className="rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 font-mono">
                      Inference
                    </span>
                    <span className="rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 font-mono">
                      ␣is
                    </span>
                    <span className="rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 font-mono">
                      ␣fun
                    </span>
                    <span className="rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 font-mono">
                      !
                    </span>
                  </div>
                </div>

                <ArrowRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />

                {/* 3. Integer IDs */}
                <div className="flex flex-col items-center rounded-md border bg-card p-2.5 shadow-2xs min-w-[110px]">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">
                    Token IDs
                  </span>
                  <span className="font-mono text-primary font-bold">
                    [365, 370, 368, 2]
                  </span>
                </div>

                <ArrowRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />

                {/* 4. Model */}
                <div className="flex flex-col items-center rounded-md border bg-card p-2.5 shadow-2xs min-w-[90px]">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">
                    LLM
                  </span>
                  <div className="flex items-center gap-1 font-semibold text-xs">
                    <Cpu className="size-3.5 text-primary" aria-hidden="true" />
                    <span>Model</span>
                  </div>
                </div>

                <ArrowRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />

                {/* 5. Next token ID */}
                <div className="flex flex-col items-center rounded-md border bg-card p-2.5 shadow-2xs min-w-[100px]">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">
                    Next ID → Text
                  </span>
                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    [152] → &quot;␣Yes&quot;
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                Common words like &quot;is&quot; or &quot;fun&quot; become a single
                token (often with their leading space attached). Rare words,
                code, and numbers split into multiple tokens.
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={() => setActiveSection("try")}
              className="gap-1.5"
            >
              <span>Continue to Try</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </LevelSectionContent>

      {/* 2. TRY SECTION */}
      <LevelSectionContent section="try">
        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">
              Interactive Tokenizer Sandbox
            </h3>
            <p className="text-muted-foreground text-sm">
              Type or paste any text below to see live token chunks, assigned
              numeric IDs, and character/word counts.
            </p>
          </div>

          {/* Sample Preset Buttons */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-medium">
              Try a preset example:
            </Label>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  size="sm"
                  variant={tryText === preset.text ? "default" : "outline"}
                  aria-pressed={tryText === preset.text}
                  onClick={() => setTryText(preset.text)}
                  className="h-8 text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Text Input */}
          <div className="space-y-2">
            <Label htmlFor="try-text-input" id="try-text-label">
              Input Text
            </Label>
            <Input
              id="try-text-input"
              aria-labelledby="try-text-label"
              value={tryText}
              onChange={(e) => setTryText(e.target.value)}
              placeholder="Type any sentence, code snippet, or numbers..."
              className="font-mono text-sm"
            />
          </div>

          {/* Live Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/20">
              <CardContent className="pt-4 pb-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Characters
                </div>
                <div className="text-2xl font-bold font-mono text-foreground mt-0.5">
                  {tryStats.characters}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/20">
              <CardContent className="pt-4 pb-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Words
                </div>
                <div className="text-2xl font-bold font-mono text-foreground mt-0.5">
                  {tryStats.words}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/20">
              <CardContent className="pt-4 pb-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Tokens
                </div>
                <div className="text-2xl font-bold font-mono text-primary mt-0.5">
                  {tryStats.tokens}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/20">
              <CardContent className="pt-4 pb-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Chars / Token
                </div>
                <div className="text-2xl font-bold font-mono text-foreground mt-0.5">
                  {tryStats.charsPerToken}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Token Chips Display */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Hash className="size-4 text-primary" aria-hidden="true" />
                  <span>Token Chunks &amp; IDs ({tryTokens.length})</span>
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {tryTokens.length} tokens
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {tryTokens.length > 0 ? (
                <div
                  data-testid="try-token-chips"
                  className="flex flex-wrap gap-1.5 min-h-12 p-3 rounded-md bg-muted/30 border border-muted"
                >
                  {tryTokens.map((tok, idx) => (
                    <TokenChip
                      key={`${idx}-${tok.id}`}
                      text={tok.text}
                      id={tok.id}
                      index={idx}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground italic border rounded-md">
                  Enter text above to inspect tokens.
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>Note on Real Tokenizers:</strong> Production LLMs use
            Byte-Pair Encoding (BPE) with 32k–128k vocabulary tokens. This toy
            tokenizer uses a compact greedy longest-match vocabulary, but
            operates on the same intuition: common words are 1 token, while rare
            words, numbers, code, and non-English text split into multiple
            tokens.
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
              <ArrowRight className="size-4" aria-hidden="true" />
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
                Level 0 Challenges: Token Intuition
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
              Complete both tokenization challenges below to master how text is
              divided before being served by an LLM.
            </p>
          </div>

          {/* Goal 1: Efficient sentence */}
          <Card
            className={
              sentenceResult.passes
                ? "border-emerald-500/40 bg-emerald-500/5"
                : ""
            }
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Target className="size-4 text-primary" aria-hidden="true" />
                  <span>Goal 1: High-Efficiency Sentence</span>
                </CardTitle>
                <Badge
                  variant={sentenceResult.passes ? "default" : "secondary"}
                  className={
                    sentenceResult.passes
                      ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                      : ""
                  }
                >
                  {sentenceResult.passes ? "Goal 1 Passed ✓" : "Incomplete"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p
                id="challenge-sentence-desc"
                className="text-xs text-muted-foreground leading-relaxed"
              >
                Write a sentence of <strong>at least 8 words</strong> that uses{" "}
                <strong>at most 10 tokens</strong>.
              </p>

              <div className="space-y-1.5">
                <Label
                  htmlFor="challenge-sentence-input"
                  id="challenge-sentence-label"
                  className="text-xs"
                >
                  Your Sentence:
                </Label>
                <Input
                  id="challenge-sentence-input"
                  aria-labelledby="challenge-sentence-label"
                  aria-describedby="challenge-sentence-desc"
                  value={challengeSentence}
                  onChange={(e) => setChallengeSentence(e.target.value)}
                  placeholder="e.g. The quick brown fox jumps over the lazy dog."
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span
                  className={
                    sentenceResult.wordCount >= 8
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "text-muted-foreground"
                  }
                >
                  Words: {sentenceResult.wordCount} / 8 min
                </span>
                <span>•</span>
                <span
                  className={
                    sentenceResult.wordCount >= 8 &&
                    sentenceResult.tokenCount <= 10
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : sentenceResult.tokenCount > 10
                        ? "text-destructive font-semibold"
                        : "text-muted-foreground"
                  }
                >
                  Tokens: {sentenceResult.tokenCount} / 10 max
                </span>
              </div>

              {sentenceTokens.length > 0 && (
                <div
                  data-testid="sentence-chips-preview"
                  className="flex flex-wrap gap-1 p-2 rounded bg-muted/20 border text-xs"
                >
                  {sentenceTokens.map((tok, idx) => (
                    <TokenChip
                      key={`${idx}-${tok.id}`}
                      text={tok.text}
                      id={tok.id}
                      index={idx}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Goal 2: Token-heavy word */}
          <Card
            className={
              wordResult.passes ? "border-emerald-500/40 bg-emerald-500/5" : ""
            }
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Target className="size-4 text-primary" aria-hidden="true" />
                  <span>Goal 2: Token-Heavy Word</span>
                </CardTitle>
                <Badge
                  variant={wordResult.passes ? "default" : "secondary"}
                  className={
                    wordResult.passes
                      ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                      : ""
                  }
                >
                  {wordResult.passes ? "Goal 2 Passed ✓" : "Incomplete"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p
                id="challenge-word-desc"
                className="text-xs text-muted-foreground leading-relaxed"
              >
                Find a single word that splits into{" "}
                <strong>4 or more tokens</strong>.
              </p>

              <div className="space-y-1.5">
                <Label
                  htmlFor="challenge-word-input"
                  id="challenge-word-label"
                  className="text-xs"
                >
                  Your Word:
                </Label>
                <Input
                  id="challenge-word-input"
                  aria-labelledby="challenge-word-label"
                  aria-describedby="challenge-word-desc"
                  value={challengeWord}
                  onChange={(e) => setChallengeWord(e.target.value)}
                  placeholder="e.g. antidisestablishmentarianism or supercalifragilistic"
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span
                  className={
                    wordResult.isSingleWord
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "text-muted-foreground"
                  }
                >
                  Single word: {wordResult.isSingleWord ? "Yes" : "No"}
                </span>
                <span>•</span>
                <span
                  className={
                    wordResult.tokenCount >= 4
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "text-muted-foreground"
                  }
                >
                  Tokens: {wordResult.tokenCount} / 4 min
                </span>
              </div>

              {wordTokens.length > 0 && (
                <div
                  data-testid="word-chips-preview"
                  className="flex flex-wrap gap-1 p-2 rounded bg-muted/20 border text-xs"
                >
                  {wordTokens.map((tok, idx) => (
                    <TokenChip
                      key={`${idx}-${tok.id}`}
                      text={tok.text}
                      id={tok.id}
                      index={idx}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Overall completion notification */}
          <Card
            role="status"
            aria-live="polite"
            className={
              isCompleted || bothChallengesPassed
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "bg-muted/20"
            }
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    isCompleted || bothChallengesPassed
                      ? "bg-emerald-600 text-white"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {isCompleted || bothChallengesPassed ? (
                    <CheckCircle2 className="size-5" aria-hidden="true" />
                  ) : (
                    <Zap className="size-5" aria-hidden="true" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold">
                    {isCompleted || bothChallengesPassed
                      ? "Level 0 Completed!"
                      : "Complete both goals to pass"}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {isCompleted || bothChallengesPassed
                      ? "Both tokenization challenges are satisfied. Your progress is saved."
                      : "Satisfy Goal 1 and Goal 2 to unlock Level 1."}
                  </p>
                </div>
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
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </LevelSectionContent>

      {/* 4. RECAP SECTION */}
      <LevelSectionContent section="recap">
        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">Key Takeaways</h3>
            <p className="text-muted-foreground text-sm">
              Here is what you learned in Level 0:
            </p>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong>Models read and write tokens, not words:</strong> Large
                language models operate entirely on discrete integer token IDs
                rather than raw character strings.
              </span>
            </div>

            <div className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong>Inference scales with token count:</strong> Memory
                allocation (KV cache), prefill compute, per-step decode latency,
                and API pricing are all quantified per token.
              </span>
            </div>

            <div className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong>Common words are cheap, rare strings are expensive:</strong>{" "}
                High-frequency English words compress into 1 token, while rare
                words, numbers, code, and non-English scripts take multiple
                tokens.
              </span>
            </div>

            <div className="flex items-start gap-2.5 text-sm">
              <Sparkles className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong>Rule of Thumb:</strong> On average in English, expect{" "}
                <strong>~4 characters</strong> or <strong>~0.75 words</strong>{" "}
                per token.
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
