# CLAUDE.md — Wordsmither

A local-only, **zero-cost** writing-analysis web app. Paste text, toggle rules,
get findings highlighted inline plus an Overview tab of stats. **No backend, no
API, no AI** — everything runs deterministically in the browser. (AI was
prototyped then removed; only revisit it deliberately — the user wants the app
free. See `TODO.md`.)

## Run / verify

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

⚠️ **Do not `npm run build` while `npm run dev` is running** — they share
`.next` and it corrupts the dev server (500s). To build: stop dev, `rm -rf
.next`, build; then `rm -rf .next` and restart dev.

## Architecture

```
app/page.tsx              # client root: editor + tabbed results/overview + config
lib/
  text.ts                 # shared word tokenizer + pronounBase (curly ’ + contractions)
  highlights.ts           # live editor highlights (sentence-opening pronoun spans)
  stats.ts                # Overview metrics (counts, POS %, word frequency) — uses compromise
  analyze.ts              # runs enabled rules → sorted, enriched findings (synchronous)
  rules/
    types.ts              # Rule, RawFinding, Finding, RuleConfig, Severity, RuleSetId
    deterministic.ts      # ALL rules + detectors live here
    registry.ts           # allRules, getRule, rulesBySet, defaultConfig
components/
  HighlightedEditor.tsx   # textarea + synced backdrop overlay (findings + live layer)
  RuleConfigPanel.tsx     # collapsible per-set on/off toggles
  ResultsPanel.tsx        # findings grouped by set → severity; click to "locate"
  OverviewPanel.tsx       # stat cards + frequency list
```

## Rule model

Every rule is a `Rule`: `{ id, name, description, ruleSet, severity,
defaultEnabled, check(text) => RawFinding[] }`. There is no `type`/AI field —
all rules are deterministic functions.

- **Rule sets** (`RuleSetId`): `mechanics`, `AP`, `Chicago`, `APA`, `MLA`,
  `custom`. Style-guide sets hold deterministic per-guide checks (number style,
  serial comma); `custom` holds project-specific rules.
- Rules are collected in `deterministic.ts` as `mechanicsRules`, `styleRules`,
  `customRules` → `deterministicRules` → `registry.allRules`.
- **Config** is just `Record<ruleId, boolean>` (on/off). No rule-builder UI.

### Adding a rule

Append an object to the appropriate array in `deterministic.ts` with a
`check(text)` returning `RawFinding[]`. It auto-registers everywhere (config
panel, analysis, highlighting). A `RawFinding` should include `start`/`end`
char offsets (enables inline highlight + "locate" + future apply-suggestion)
and an optional `suggestion`.

Current custom rules: **Pronoun overuse** (density/run heuristics, tunable
constants at top of the pronoun section), **Homophones** (curated context
patterns + POS-based `you're→your` via compromise), **Em dash spacing**,
**Ellipsis spacing**.

## Conventions & gotchas

- **Tokenizing words**: always use `tokenizeWords` / `pronounBase` from
  `lib/text.ts`. The regex handles curly apostrophes (`’`) and contractions so
  `I’m`/`he’s` count as one word and pronoun matching sees the base. Don't
  reinvent `\b[A-Za-z']+\b` — it splits curly-quoted contractions.
- **Deterministic precision > recall**: prefer high-confidence patterns that
  stay quiet over noisy matches. Heuristic/context-blind rules default OFF
  (`defaultEnabled: false`) and say so in their `description`.
- **`compromise`** (POS tagger) is **client-side only** — used in `stats.ts`
  (adverb/adjective %) and `deterministic.ts` (`you're→your` noun check). Keep
  it out of any server module.
- **Highlight overlay**: `HighlightedEditor` renders a transparent-text backdrop
  of `<mark>` spans behind the textarea, scroll-synced, with `scrollbar-gutter:
  stable` on both layers so wrapping matches. Findings highlights only show when
  not stale (`analyzedText === text`); the live layer (`liveHighlights`) is
  always on. Layout needs `min-h-0` down the flex/grid chain or it locks scroll.
- **Severity colors**: error=red, warning=amber, suggestion=sky; live layer=
  violet; active-finding ring=amber.

## Testing a detector quickly

Modules with value imports of extensionless paths (e.g. `./text`) can't be
imported directly by `node`. To unit-check regex/detector logic, replicate the
function in a standalone `.mjs` run from the project root (so `compromise`
resolves), or temporarily test a type-only-import module via Node's TS support.
