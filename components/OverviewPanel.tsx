"use client";

import { useMemo, useState } from "react";
import { computeStats, STOPWORDS, type Metric } from "@/lib/stats";

const FREQ_DISPLAY_CAP = 300;

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
      <div className="text-2xl font-semibold tabular-nums text-stone-800">
        {value}
      </div>
      <div className="mt-0.5 text-xs font-medium text-stone-500">{label}</div>
      {sub && <div className="text-[11px] text-stone-400">{sub}</div>}
    </div>
  );
}

function metricCard(label: string, m: Metric) {
  return (
    <StatCard
      label={label}
      value={`${m.pct}%`}
      sub={`${m.count.toLocaleString()} ${m.count === 1 ? "word" : "words"}`}
    />
  );
}

export function OverviewPanel({ text }: { text: string }) {
  const stats = useMemo(() => computeStats(text), [text]);
  const [filter, setFilter] = useState("");
  const [hideCommon, setHideCommon] = useState(true);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return stats.frequency.filter(
      (f) =>
        (!hideCommon || !STOPWORDS.has(f.word)) &&
        (!q || f.word.includes(q)),
    );
  }, [stats.frequency, filter, hideCommon]);

  const maxCount = filtered.length ? filtered[0].count : 0;
  const shown = filtered.slice(0, FREQ_DISPLAY_CAP);

  if (stats.wordCount === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="max-w-xs text-center text-sm text-stone-400">
          Type or paste text to see word count, parts of speech, and word
          frequency.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-stone-200 px-5 py-4">
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="Words"
            value={stats.wordCount.toLocaleString()}
            sub={`${stats.uniqueCount.toLocaleString()} unique`}
          />
          {metricCard("Pronouns", stats.pronoun)}
          {metricCard("Adverbs", stats.adverb)}
          {metricCard("Adjectives", stats.adjective)}
        </div>
        <p className="mt-2 text-[11px] text-stone-400">
          Pronoun share is exact; adverb and adjective shares are estimated by a
          local part-of-speech tagger.
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-stone-200 px-5 py-2.5">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter words…"
          className="min-w-0 flex-1 rounded border border-stone-300 bg-white px-2 py-1 text-sm outline-none focus:border-amber-400"
        />
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-stone-600">
          <input
            type="checkbox"
            checked={hideCommon}
            onChange={(e) => setHideCommon(e.target.checked)}
            className="h-3.5 w-3.5 accent-amber-700"
          />
          Hide common
        </label>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-3">
        <div className="mb-2 text-xs text-stone-500">
          {filtered.length.toLocaleString()} words
          {filtered.length > FREQ_DISPLAY_CAP &&
            ` · showing top ${FREQ_DISPLAY_CAP}`}
        </div>
        <ul className="space-y-1">
          {shown.map((f) => (
            <li key={f.word} className="flex items-center gap-2 text-sm">
              <span className="w-32 shrink-0 truncate text-stone-800">
                {f.word}
              </span>
              <span className="relative h-4 flex-1 overflow-hidden rounded bg-stone-100">
                <span
                  className="absolute inset-y-0 left-0 rounded bg-amber-200"
                  style={{
                    width: `${maxCount ? (f.count / maxCount) * 100 : 0}%`,
                  }}
                />
              </span>
              <span className="w-10 shrink-0 text-right tabular-nums text-stone-600">
                {f.count}
              </span>
            </li>
          ))}
        </ul>
        {shown.length === 0 && (
          <p className="mt-6 text-center text-sm text-stone-400">
            No words match.
          </p>
        )}
      </div>
    </div>
  );
}
