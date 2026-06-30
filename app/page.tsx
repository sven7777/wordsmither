"use client";

import { useMemo, useState } from "react";
import { analyze, countWords, type AnalysisResult } from "@/lib/analyze";
import { defaultConfig } from "@/lib/rules/registry";
import { sentenceInitialPronounSpans } from "@/lib/highlights";
import type { Finding, RuleConfig } from "@/lib/rules/types";
import { RuleConfigPanel } from "@/components/RuleConfigPanel";
import { ResultsPanel } from "@/components/ResultsPanel";
import { OverviewPanel } from "@/components/OverviewPanel";
import { HighlightedEditor } from "@/components/HighlightedEditor";

const WORD_LIMIT = 4000;
const HARD_LIMIT = 4500;

export default function Home() {
  const [text, setText] = useState("");
  const [config, setConfig] = useState<RuleConfig>(() => defaultConfig());
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [active, setActive] = useState<Finding | null>(null);
  const [tab, setTab] = useState<"findings" | "overview">("findings");
  const [highlightPronouns, setHighlightPronouns] = useState(false);

  // Highlights are only valid against the exact text that was analyzed.
  const stale = !!result && result.analyzedText !== text;
  const highlightFindings = result && !stale ? result.findings : [];

  // Live highlight layer, recomputed as you type (independent of analysis).
  const pronounSpans = useMemo(
    () => (highlightPronouns ? sentenceInitialPronounSpans(text) : []),
    [highlightPronouns, text],
  );

  const words = useMemo(() => countWords(text), [text]);
  const overLimit = words > WORD_LIMIT;
  const overHard = words > HARD_LIMIT;
  const anyEnabled = useMemo(
    () => Object.values(config).some(Boolean),
    [config],
  );

  function runAnalysis() {
    if (!text.trim() || overHard || !anyEnabled) return;
    setActive(null);
    setResult(analyze(text, config));
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--background)]">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-stone-900">
            Wordsmither
          </h1>
          <p className="text-xs text-stone-500">
            Analyze writing against AP · Chicago · APA · MLA — and your own rules.
          </p>
        </div>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={!text.trim() || overHard || !anyEnabled}
          className="rounded-md bg-amber-700 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          Analyze
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px] overflow-hidden lg:grid-cols-[1fr_minmax(360px,440px)_320px]">
        {/* Editor */}
        <main className="flex min-h-0 min-w-0 flex-col border-r border-stone-200">
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-2.5 text-xs">
            <label className="flex cursor-pointer items-center gap-1.5 text-stone-600">
              <input
                type="checkbox"
                checked={highlightPronouns}
                onChange={(e) => setHighlightPronouns(e.target.checked)}
                className="h-3.5 w-3.5 accent-violet-600"
              />
              <span className="inline-flex items-center gap-1">
                Highlight
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-300 align-middle" />
                sentence-opening pronouns
              </span>
            </label>
            <span
              className={
                overHard
                  ? "font-medium text-red-600"
                  : overLimit
                    ? "font-medium text-amber-600"
                    : "text-stone-500"
              }
            >
              {words.toLocaleString()} {words === 1 ? "word" : "words"}
              {overLimit && !overHard && " · over recommended limit"}
              {overHard && ` · exceeds ${HARD_LIMIT.toLocaleString()}-word cap`}
            </span>
          </div>
          <HighlightedEditor
            value={text}
            onChange={(next) => {
              setText(next);
              if (active) setActive(null);
            }}
            findings={highlightFindings}
            active={active}
            liveHighlights={pronounSpans}
            placeholder="Paste your draft here…"
          />
        </main>

        {/* Results / Overview — sits between editor and config on wide screens */}
        <section className="order-last flex min-h-0 min-w-0 flex-col overflow-hidden border-stone-200 bg-stone-50 lg:order-none lg:border-r">
          <div className="flex shrink-0 border-b border-stone-200 bg-white">
            <button
              type="button"
              onClick={() => setTab("findings")}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition ${
                tab === "findings"
                  ? "border-b-2 border-amber-700 text-stone-900"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Findings
              {result && result.findings.length > 0 && (
                <span className="ml-1.5 rounded-full bg-stone-200 px-1.5 py-0.5 text-[11px] tabular-nums text-stone-600">
                  {result.findings.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("overview")}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition ${
                tab === "overview"
                  ? "border-b-2 border-amber-700 text-stone-900"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Overview
            </button>
          </div>
          <div className="min-h-0 flex-1">
            {tab === "findings" ? (
              <ResultsPanel
                result={result}
                active={active}
                onSelect={setActive}
                stale={stale}
              />
            ) : (
              <OverviewPanel text={text} />
            )}
          </div>
        </section>

        {/* Config */}
        <section className="min-h-0 min-w-0 overflow-hidden bg-white">
          <RuleConfigPanel config={config} onChange={setConfig} />
        </section>
      </div>
    </div>
  );
}
