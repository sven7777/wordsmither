# Wordsmither — TODO

## Done

- ✅ **Removed AI entirely** (2026-06-17). Deleted `app/api/analyze` and the
  fetch path; removed the LLM rules, the `type`/`source` discriminator, AI
  badges/banners, and the `@anthropic-ai/sdk` dep. Every rule is now a
  deterministic, client-side `Rule`. Analysis is synchronous and instant.
- ✅ Inline highlighting in the editor (synced backdrop overlay; click a finding
  to locate it).
- ✅ Overview tab: word count, pronoun/adverb/adjective %, word-frequency list.
- ✅ Shared tokenizer (`lib/text.ts`) — curly apostrophes + contractions count
  as one word; pronoun matching sees through contractions.
- ✅ Custom rules: **Pronoun overuse**, **Homophones**, **Em dash spacing**,
  **Ellipsis spacing**.
- ✅ Live toggle: highlight all sentence-opening pronouns (violet layer,
  `lib/highlights.ts`).
- ✅ Hid the Next.js dev indicator (`devIndicators: false`).

## Next up

### 1. Apply-suggestion action
Findings carry `suggestion` + `start`/`end` offsets.
- Add an **Apply** button on finding cards that have a `suggestion` and offsets
  (`components/ResultsPanel.tsx`).
- On apply: splice `text[start:end]` → `suggestion`, `setText(...)`, re-run
  analysis (offsets shift after an edit — recompute, don't trust stale offsets).
- Consider **Apply all**: sort by `start` **descending** and splice so earlier
  offsets aren't invalidated mid-batch.

### 2. localStorage persistence + Clear button
- Persist **rule config** + **current text** to localStorage; load on mount,
  save on change (debounce the text). Keys `wordsmither.config` /
  `wordsmither.text`. Version the config blob so adding/removing rules later
  doesn't load a stale shape.
- Add a **Clear** button for the editor text (none yet) — clears text + resets
  results/active finding.

## Ideas / maybe later
- AI rules (LanguageTool self-host, or Claude) — only if we decide the cost is
  worth it; design it deliberately. See `[[wordsmither-no-cost-preference]]`.
- Widen Homophones coverage as gaps show up.
- Click a word in the Overview frequency list to highlight its occurrences.
- Option to include `there`/`here` in the sentence-opening-pronoun highlight.

See `CLAUDE.md` for architecture and conventions.
