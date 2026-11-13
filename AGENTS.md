# AGENTS.md

Guidance for anyone (human or agent) changing this repository.

## What this is

Inference Lab is a static single-page web app for learning how LLM inference
serving works. It has two views that share one set of formulas:

- **Calculator**: the user enters a model, precision, GPU and workload, and sees
  memory, KV cache, latency, throughput and cost estimates.
- **Play**: short levels that teach one concept each (sampling, prefill vs
  decode, KV cache, batching, quantization), built on the same formulas.

It is deployed to GitHub Pages as static files.

## Stack

- **Vite + React + TypeScript**, scaffolded with the shadcn CLI.
- **shadcn/ui** (latest, v4.x) with the **Base UI** component library
  (`@base-ui/react`) and the **nova** preset. Tailwind CSS v4.
- **Vitest** for unit tests.
- Icons: `lucide-react`. Charts (later): shadcn `chart` component (Recharts).

## Rules

- **Use shadcn components.** Add them with `npx shadcn@latest add <name>`
  instead of hand-writing UI primitives or installing other UI libraries.
  Do not edit generated files in `src/components/ui/` unless an issue asks for it.
- **One source of truth for the math.** All formulas live in
  `src/lib/model.ts` as pure, typed functions (inputs in, numbers out; no React,
  no DOM). UI code and game levels import from it; never duplicate a formula.
- **Every formula is tested.** Any change to `src/lib/model.ts` adds or updates
  tests in `src/lib/model.test.ts`.
- **Handle non-positive inputs safely without artificial clamping.** Pure formulas
  in `src/lib/model.ts` must return `0` (or a safe zero result) whenever any
  input parameter represents non-positive capacity or invalid dimensions (e.g.,
  `gpuCount <= 0`, `parameters <= 0`, `contextLength <= 0`). Never use
  `Math.max(1, ...)` or artificial clamps on count/dimension parameters to
  prevent division by zero; non-positive inputs indicate zero capacity or an
  invalid request, not 1 unit of capacity. Guard with early returns
  (`if (effectiveFlops <= 0) return 0`) or let non-positive effective capacity
  return 0.
- **Show the formula.** Every calculator output displays the formula used and
  the values plugged in, so the user can check the math by hand.
- **Units are explicit.** Every displayed number has a unit (GB, ms, tokens/s,
  $/1M tokens). Use decimal GB (1 GB = 1e9 bytes) and say so in the UI.
- **Estimates, not benchmarks.** Keep a visible note that results are rough
  ballparks; real numbers depend on kernels, framework and interconnect.
- **Static only.** No backend, no network calls at runtime, no environment
  secrets. The app must work when served from a sub-path on GitHub Pages
  (set `base: "./"` in `vite.config.ts`).
- **No router needed** yet: switch views with React state.

## Reference formulas

Use these unless an issue says otherwise:

- Weight memory (bytes) = parameters × bytes per parameter
  (FP16/BF16 = 2, FP8 = 1, INT4 = 0.5)
- KV cache per token (bytes) = 2 × layers × KV heads × head dim × bytes per element
- KV capacity (tokens) = (GPU memory × GPUs − weight memory − overhead) ÷ KV per token
- Prefill time ≈ 2 × parameters × prompt tokens ÷ (peak FLOPS × utilization)
- Decode step time ≈ (weight bytes + KV bytes read) ÷ (memory bandwidth × utilization)
- Cost per 1M tokens = ($/hour × GPUs) ÷ (tokens per hour ÷ 1e6)

Sanity checks the tests must include:

- 70B params at FP16 → 140 GB of weights
- Llama-3-8B (32 layers, 8 KV heads, head dim 128) at FP16 → 131,072 bytes
  (128 KiB) of KV cache per token
- **Boundary sanity checks:** For every formula in `src/lib/model.ts`, the
  corresponding test suite in `src/lib/model.test.ts` must include a `handles
  zero or non-positive inputs safely` test block verifying that passing `0` and
  negative values for *each* numeric parameter (including optional parameters
  such as `gpuCount`) returns `0` safely without throwing, dividing by zero, or
  returning `NaN`/`Infinity`.

## Layout

```
src/
  App.tsx              # app shell: sidebar + header + current view
  components/          # app components (app-sidebar, site-header, ...)
  components/ui/       # generated shadcn components (do not hand-edit)
  pages/               # calculator-page.tsx, play-page.tsx
  lib/model.ts         # pure formulas
  lib/model.test.ts    # Vitest tests for the formulas
```

## Commands

All of these must pass before a PR is ready:

```bash
npm ci
npm run lint
npm run typecheck
npm test          # vitest run
npm run build
```

## Style

- Small, readable components and functions; comments explain *why*, not *what*.
- Usable on a phone-width screen; support the light and dark themes that the
  scaffold provides.
- Keep PRs focused on the issue being solved.
