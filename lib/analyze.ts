// Client-side analysis: run the enabled deterministic rules over the text and
// return a sorted list of findings. Everything is local and instant.

import { runDeterministic } from "./rules/deterministic";
import { getRule } from "./rules/registry";
import { tokenizeWords } from "./text";
import type { Finding, RawFinding, RuleConfig, Severity } from "./rules/types";
import { SEVERITY_ORDER } from "./rules/types";

function enrich(raw: RawFinding): Finding | null {
  const rule = getRule(raw.ruleId);
  if (!rule) return null;
  return {
    ...raw,
    ruleName: rule.name,
    ruleSet: rule.ruleSet,
    severity: (raw.severity ?? rule.severity) as Severity,
  };
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    const posA = a.start ?? Number.MAX_SAFE_INTEGER;
    const posB = b.start ?? Number.MAX_SAFE_INTEGER;
    return posA - posB;
  });
}

export interface AnalysisResult {
  findings: Finding[];
  /** Snapshot of the text that produced these findings (for offset alignment). */
  analyzedText: string;
}

export function analyze(text: string, config: RuleConfig): AnalysisResult {
  const findings = runDeterministic(text, (id) => !!config[id])
    .map(enrich)
    .filter((f): f is Finding => f !== null);

  return {
    findings: sortFindings(findings),
    analyzedText: text,
  };
}

export function countWords(text: string): number {
  return tokenizeWords(text).length;
}
