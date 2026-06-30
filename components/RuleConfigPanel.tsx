"use client";

import { useState } from "react";
import { RULE_SET_ORDER, rulesBySet } from "@/lib/rules/registry";
import {
  RULE_SET_LABELS,
  type RuleConfig,
  type RuleSetId,
} from "@/lib/rules/types";

const grouped = rulesBySet();

export function RuleConfigPanel({
  config,
  onChange,
  disabled,
}: {
  config: RuleConfig;
  onChange: (next: RuleConfig) => void;
  disabled?: boolean;
}) {
  // All sections collapsed by default.
  const [open, setOpen] = useState<Record<string, boolean>>({});

  function toggleSection(set: RuleSetId) {
    setOpen((prev) => ({ ...prev, [set]: !prev[set] }));
  }

  function toggleRule(id: string) {
    onChange({ ...config, [id]: !config[id] });
  }

  function setAll(setRules: { id: string }[], enable: boolean) {
    const next = { ...config };
    for (const r of setRules) next[r.id] = enable;
    onChange(next);
  }

  return (
    <aside className="flex h-full flex-col">
      <div className="border-b border-stone-200 px-5 py-4">
        <h2 className="font-serif text-lg text-stone-800">Rules</h2>
        <p className="mt-1 text-xs text-stone-500">
          Expand a section to choose which checks to apply. All checks run
          instantly on your device.
        </p>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto py-2">
        {RULE_SET_ORDER.map((set) => {
          const rules = grouped[set];
          const isOpen = !!open[set];
          const enabledCount = rules.filter((r) => config[r.id]).length;
          const allOn = rules.length > 0 && enabledCount === rules.length;

          return (
            <section key={set} className="border-b border-stone-100">
              <button
                type="button"
                onClick={() => toggleSection(set)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-stone-50"
              >
                <span className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 20 20"
                    className={`h-3.5 w-3.5 text-stone-400 transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M7 5l6 5-6 5V5z" />
                  </svg>
                  <span className="text-xs font-semibold uppercase tracking-wide text-stone-600">
                    {RULE_SET_LABELS[set]}
                  </span>
                </span>
                <span
                  className={`text-[11px] tabular-nums ${
                    enabledCount > 0 ? "text-amber-700" : "text-stone-400"
                  }`}
                >
                  {rules.length === 0
                    ? "soon"
                    : `${enabledCount}/${rules.length} on`}
                </span>
              </button>

              {isOpen && (
                <div className="px-5 pb-4">
                  {rules.length === 0 ? (
                    <p className="text-xs italic text-stone-400">
                      No rules yet — we&apos;ll add them here.
                    </p>
                  ) : (
                    <>
                      <div className="mb-1 flex justify-end">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => setAll(rules, !allOn)}
                          className="text-[11px] text-amber-700 hover:underline disabled:opacity-40"
                        >
                          {allOn ? "Disable all" : "Enable all"}
                        </button>
                      </div>
                      <ul className="space-y-1.5">
                        {rules.map((rule) => (
                          <li key={rule.id}>
                            <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-stone-100">
                              <input
                                type="checkbox"
                                checked={!!config[rule.id]}
                                disabled={disabled}
                                onChange={() => toggleRule(rule.id)}
                                className="mt-0.5 h-4 w-4 accent-amber-700"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm text-stone-800">
                                  {rule.name}
                                </span>
                                <span className="mt-0.5 block text-xs leading-snug text-stone-500">
                                  {rule.description}
                                </span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
