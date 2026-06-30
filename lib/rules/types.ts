// Core domain types for the rule engine.
//
// Every rule is deterministic: a pure function over the text, run client-side
// for instant, free feedback. Rules are grouped into rule *sets* — the four
// style guides, a cross-cutting `mechanics` set, and a `custom` set we grow
// over time. The user's only configuration is which rules are enabled.

export type StyleGuide = "AP" | "Chicago" | "APA" | "MLA";

export type RuleSetId = StyleGuide | "mechanics" | "custom";

export type Severity = "error" | "warning" | "suggestion";

export interface RuleMeta {
  id: string;
  name: string;
  description: string;
  ruleSet: RuleSetId;
  /** Default severity for findings from this rule. */
  severity: Severity;
  /** Whether the rule is on by default in a fresh config. */
  defaultEnabled: boolean;
}

/** A finding as produced by a rule, before enrichment with rule metadata. */
export interface RawFinding {
  ruleId: string;
  message: string;
  /** The offending span of text, quoted verbatim. */
  snippet: string;
  /** Character offsets into the source text, when known. */
  start?: number;
  end?: number;
  /** Optional concrete fix. */
  suggestion?: string;
  /** Per-finding severity override. */
  severity?: Severity;
}

export interface Rule extends RuleMeta {
  check: (text: string) => RawFinding[];
}

/** A finding enriched with the rule's metadata, ready for display. */
export interface Finding extends RawFinding {
  ruleName: string;
  ruleSet: RuleSetId;
  severity: Severity;
}

/** Map of ruleId -> enabled. */
export type RuleConfig = Record<string, boolean>;

export const RULE_SET_LABELS: Record<RuleSetId, string> = {
  mechanics: "General mechanics",
  AP: "AP (journalism)",
  Chicago: "Chicago (publishing)",
  APA: "APA (social sciences)",
  MLA: "MLA (humanities)",
  custom: "Custom rules",
};

export const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warning: 1,
  suggestion: 2,
};
