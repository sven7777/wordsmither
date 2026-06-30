# Contributing to Wordsmither

Thanks for your interest! Wordsmither is a small, **local-only, zero-cost**
writing analyzer — every rule is a deterministic function that runs in the
browser. There is no backend, no API, and no AI. Contributions should keep it
that way.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build      # static export to ./out
```

> ⚠️ Don't run `npm run build` while `npm run dev` is running — they share
> `.next` and it corrupts the dev server. Stop dev first.

## Project layout & conventions

See [`CLAUDE.md`](CLAUDE.md) for the architecture, the rule model, and the
gotchas (tokenizing words, the highlight overlay, keeping `compromise`
client-side, etc.). A few highlights:

- **Add a rule** by appending a `Rule` to the right array in
  [`lib/rules/deterministic.ts`](lib/rules/deterministic.ts). It auto-registers
  in the config panel, analysis, and highlighting. Include `start`/`end` char
  offsets (and a `suggestion` where it makes sense).
- **Tokenize with** `tokenizeWords` / `pronounBase` from `lib/text.ts` — don't
  reinvent the word regex (it handles curly apostrophes and contractions).
- **Precision over recall.** Prefer high-confidence patterns that stay quiet
  over noisy matches. Heuristic/context-blind rules default to `enabled: false`
  and say so in their `description`.

## Pull requests

1. Fork and branch off `main`.
2. Make sure `npm run typecheck` and `npm run build` both pass (CI runs both).
3. Keep PRs focused; describe what the rule/change does and why.
4. New rules: include a sentence or two of example text the rule should (and
   shouldn't) flag.

## Scope

Wordsmither intentionally stays free and fully local. Proposals that add a
backend, a paid API, or telemetry are out of scope unless discussed first in an
issue.
