# Wordsmither

A writing-analysis web app. Paste up to ~4,000 words and check it against style
standards and configurable custom rules. Everything runs **locally in the
browser** — there is no backend, no API, and no cost to run.

## How it works

Every rule is **deterministic**: a pure function over the text that runs
instantly client-side. Rules live in a single registry (`lib/rules/`) grouped
into **rule sets**:

- **General mechanics** — cross-guide checks (double spaces, repeated words,
  spacing around punctuation, etc.).
- **AP / Chicago / APA / MLA** — per-guide deterministic checks (number style,
  serial comma).
- **Custom** — project-specific rules (e.g. pronoun overuse, homophones).

The only user-facing configuration is which rules are **enabled** for an
analysis — there is no rule-builder UI by design.

> Earlier prototypes included optional LLM-backed style rules; that path was
> removed to keep the app free and fully local. See `TODO.md` if/when we revisit
> it.

### Architecture

```
app/
  page.tsx              # editor + config + results/overview (client)
lib/
  text.ts               # shared word tokenizer (contractions, curly quotes)
  rules/
    types.ts            # domain types
    deterministic.ts    # all rules (mechanics, per-guide, custom)
    registry.ts         # single source of truth + config helpers
  analyze.ts            # runs enabled rules, returns sorted findings
  stats.ts              # overview metrics (word/POS counts, frequency)
components/
  HighlightedEditor.tsx # textarea + synced highlight overlay
  RuleConfigPanel.tsx   # collapsible on/off toggles per rule
  ResultsPanel.tsx      # findings grouped by rule set + severity
  OverviewPanel.tsx     # word count, pronoun/adverb/adjective %, frequency
```

Analysis state is **ephemeral** — nothing is persisted (yet).

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

Wordsmither is 100% client-side, so it builds to a **static site** — no Node
server required. `next.config.ts` sets `output: "export"`, so:

```bash
npm run build      # emits a static site to ./out
```

> ⚠️ Don't run `npm run build` while `npm run dev` is running — they share
> `.next` and it corrupts the dev server. Stop dev first (and `rm -rf .next` if
> it's misbehaving).

Upload the **contents of `out/`** to any static host. For **DreamHost** (shared
hosting), SFTP the files into the domain's web directory:

```bash
# example — adjust user/host/path to your DreamHost SFTP account
rsync -avz --delete out/ <sftp-user>@<host>:/home/<sftp-user>/<your-domain>/
```

No environment variables, build step on the server, or database are needed.

## License

[MIT](LICENSE) © Derek Law.

## Adding a rule

Add an entry to `deterministicRules` (mechanics/per-guide) or `customRules`
(custom) in `lib/rules/deterministic.ts` with a `check(text)` function that
returns findings. It appears automatically in the config panel and results.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
`compromise` (local part-of-speech tagging for the Overview stats).
