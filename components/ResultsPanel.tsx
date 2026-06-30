"use client";

import { useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyze";
import {
  RULE_SET_LABELS,
  type Finding,
  type RuleSetId,
  type Severity,
} from "@/lib/rules/types";
import { RULE_SET_ORDER } from "@/lib/rules/registry";

const SEVERITY_STYLES: Record<Severity, { dot: string; label: string }> = {
  error: { dot: "bg-red-500", label: "Error" },
  warning: { dot: "bg-amber-500", label: "Warning" },
  suggestion: { dot: "bg-sky-500", label: "Suggestion" },
};

function FindingCard({
  finding,
  active,
  onSelect,
}: {
  finding: Finding;
  active: boolean;
  onSelect?: (f: Finding) => void;
}) {
  const sev = SEVERITY_STYLES[finding.severity];
  const locatable = typeof finding.start === "number";
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect?.(finding)}
        className={`w-full rounded-lg border bg-white p-3.5 text-left shadow-sm transition hover:border-amber-300 ${
          active ? "border-amber-500 ring-1 ring-amber-300" : "border-stone-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${sev.dot}`} aria-hidden />
          <span className="text-xs font-medium text-stone-500">{sev.label}</span>
          <span className="truncate text-xs text-stone-400">
            · {finding.ruleName}
          </span>
          {locatable && (
            <span className="ml-auto text-[10px] text-amber-700">locate ↵</span>
          )}
        </div>
        <p className="mt-2 text-sm text-stone-800">{finding.message}</p>
        {finding.snippet && (
          <p className="mt-2 rounded bg-stone-50 px-2 py-1 font-mono text-xs text-stone-600">
            {finding.snippet}
          </p>
        )}
        {finding.suggestion && (
          <p className="mt-2 text-xs text-stone-600">
            <span className="font-medium text-emerald-700">Suggested:</span>{" "}
            <span className="font-mono">{finding.suggestion}</span>
          </p>
        )}
      </button>
    </li>
  );
}

export function ResultsPanel({
  result,
  active,
  onSelect,
  stale,
}: {
  result: AnalysisResult | null;
  active: Finding | null;
  onSelect?: (f: Finding) => void;
  /** True when the text changed since this result was produced. */
  stale?: boolean;
}) {
  const grouped = useMemo(() => {
    const map = {} as Record<RuleSetId, Finding[]>;
    for (const set of RULE_SET_ORDER) map[set] = [];
    if (result) for (const f of result.findings) map[f.ruleSet].push(f);
    return map;
  }, [result]);

  const counts = useMemo(() => {
    const c = { error: 0, warning: 0, suggestion: 0 };
    if (result) for (const f of result.findings) c[f.severity]++;
    return c;
  }, [result]);

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="max-w-xs text-center text-sm text-stone-400">
          Paste your text and run an analysis to see findings here.
        </p>
      </div>
    );
  }

  const total = result.findings.length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-stone-200 px-5 py-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-lg text-stone-800">Findings</h2>
          <span className="text-sm text-stone-500">{total} total</span>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-stone-600">
          <span>
            <span className="font-semibold text-red-600">{counts.error}</span>{" "}
            errors
          </span>
          <span>
            <span className="font-semibold text-amber-600">
              {counts.warning}
            </span>{" "}
            warnings
          </span>
          <span>
            <span className="font-semibold text-sky-600">
              {counts.suggestion}
            </span>{" "}
            suggestions
          </span>
        </div>
        {stale && (
          <p className="mt-3 rounded bg-stone-100 px-3 py-2 text-xs text-stone-600">
            Text edited since this analysis — highlights are hidden. Re-run to
            refresh.
          </p>
        )}
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {total === 0 ? (
          <p className="mt-8 text-center text-sm text-emerald-700">
            No issues found for the enabled rules. ✓
          </p>
        ) : (
          RULE_SET_ORDER.map((set) => {
            const findings = grouped[set];
            if (findings.length === 0) return null;
            return (
              <section key={set} className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {RULE_SET_LABELS[set]} ({findings.length})
                </h3>
                <ul className="space-y-2">
                  {findings.map((f, i) => (
                    <FindingCard
                      key={`${f.ruleId}-${i}`}
                      finding={f}
                      active={f === active}
                      onSelect={onSelect}
                    />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
