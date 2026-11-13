# AGENTS.md

Guidance for anyone (human or agent) changing this repository.

## What this is

Inference Lab is a small, static browser app for learning how LLM inference
serving works. It has two tabs that share one set of formulas:

- **Calculator**: the user enters a model, precision, GPU and workload, and sees
  memory, KV cache, latency, throughput and cost estimates.
- **Play**: short levels that teach one concept each (sampling, prefill vs
  decode, KV cache, batching, quantization), built on the same formulas.

## Hard rules

- **No build step, no dependencies.** Plain HTML, CSS and vanilla JavaScript.
  The app must work by opening `index.html` directly in a browser and on
  GitHub Pages. No npm, no bundlers, no CDN scripts.
- **One source of truth for the math.** All formulas live in `js/model.js` as
  pure functions (inputs in, numbers out, no DOM access). The Calculator and
  the game levels import from it; never duplicate a formula elsewhere.
- **Show the formula.** Every calculator output displays the formula used and
  the values plugged in, so the user can check the math by hand.
- **Units are explicit.** Every displayed number has a unit (GB, ms, tokens/s,
  $/1M tokens). Use decimal GB (1 GB = 1e9 bytes) and say so in the UI.
- **Estimates, not benchmarks.** Keep a visible note that results are rough
  ballparks; real numbers depend on kernels, framework and interconnect.

## Reference formulas

Use these unless an issue says otherwise:

- Weight memory (bytes) = parameters × bytes per parameter
  (FP16/BF16 = 2, FP8 = 1, INT4 = 0.5)
- KV cache per token (bytes) = 2 × layers × KV heads × head dim × bytes per element
- KV capacity (tokens) = (GPU memory × GPUs − weight memory − overhead) ÷ KV per token
- Prefill time ≈ 2 × parameters × prompt tokens ÷ (peak FLOPS × utilization)
- Decode step time ≈ (weight bytes + KV bytes read) ÷ (memory bandwidth × utilization)
- Cost per 1M tokens = ($/hour × GPUs) ÷ (tokens per hour ÷ 1e6)

Sanity checks the code must satisfy (add them to `tests.html`):

- 70B params at FP16 → 140 GB of weights
- Llama-3-8B (32 layers, 8 KV heads, head dim 128) at FP16 → 131,072 bytes
  (128 KiB) of KV cache per token

## Layout

```
index.html      # tabs + layout
css/style.css
js/model.js     # pure formulas (no DOM)
js/calculator.js
js/game.js
tests.html      # opens in a browser, runs assertions against js/model.js
```

## Testing

Open `tests.html` in a browser; it must show all checks passing. Any change to
`js/model.js` must add or update a check there.

## Style

- Small, readable functions; comments explain *why*, not *what*.
- Keep the UI usable on a phone-width screen.
- Keep PRs focused on the issue being solved.
