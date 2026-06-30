// The single source of truth for all rules. Everything else reads from here.

import { deterministicRules } from "./deterministic";
import type { Rule, RuleConfig, RuleSetId } from "./types";

export const allRules: Rule[] = [...deterministicRules];

const byId = new Map<string, Rule>(allRules.map((r) => [r.id, r]));

export function getRule(id: string): Rule | undefined {
  return byId.get(id);
}

/** Rules grouped by rule set, in display order. */
export const RULE_SET_ORDER: RuleSetId[] = [
  "mechanics",
  "AP",
  "Chicago",
  "APA",
  "MLA",
  "custom",
];

export function rulesBySet(): Record<RuleSetId, Rule[]> {
  const grouped = {} as Record<RuleSetId, Rule[]>;
  for (const set of RULE_SET_ORDER) grouped[set] = [];
  for (const rule of allRules) grouped[rule.ruleSet].push(rule);
  return grouped;
}

/** A fresh config from each rule's defaultEnabled flag. */
export function defaultConfig(): RuleConfig {
  const cfg: RuleConfig = {};
  for (const rule of allRules) cfg[rule.id] = rule.defaultEnabled;
  return cfg;
}
