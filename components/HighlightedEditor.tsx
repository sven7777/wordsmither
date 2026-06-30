"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type UIEvent,
} from "react";
import type { Finding, Severity } from "@/lib/rules/types";
import { SEVERITY_ORDER } from "@/lib/rules/types";
import type { Span } from "@/lib/highlights";

// Identical typography + box model on the textarea and the backdrop so the
// rendered marks line up exactly under the typed characters. `scrollbarGutter:
// stable` makes both reserve the same gutter width, so line wrapping matches
// even though only the textarea actually scrolls.
const SHARED_TEXT: CSSProperties = {
  margin: 0,
  border: 0,
  padding: "20px 24px",
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 15,
  lineHeight: 1.7,
  letterSpacing: 0,
  whiteSpace: "pre-wrap",
  overflowWrap: "break-word",
  wordBreak: "break-word",
  tabSize: 4,
  scrollbarGutter: "stable",
};

const SEVERITY_FILL: Record<Severity, string> = {
  error: "rgba(239, 68, 68, 0.22)",
  warning: "rgba(245, 158, 11, 0.26)",
  suggestion: "rgba(14, 165, 233, 0.20)",
};
const SEVERITY_LINE: Record<Severity, string> = {
  error: "#ef4444",
  warning: "#d97706",
  suggestion: "#0ea5e9",
};

// Live (non-finding) highlight style — must be visually distinct from findings.
const LIVE_FILL = "rgba(139, 92, 246, 0.18)";
const LIVE_LINE = "#7c3aed";

interface Segment {
  text: string;
  severity?: Severity;
  active?: boolean;
  /** Covered by a live highlight (e.g. sentence-opening pronoun). */
  live?: boolean;
}

function buildSegments(
  text: string,
  findings: Finding[],
  live: Span[],
  active: Finding | null,
): Segment[] {
  const ranges = findings.filter(
    (f) =>
      typeof f.start === "number" &&
      typeof f.end === "number" &&
      f.end > f.start,
  );
  const liveRanges = live.filter((s) => s.end > s.start);
  if (ranges.length === 0 && liveRanges.length === 0) return [{ text }];

  const len = text.length;
  const bounds = new Set<number>([0, len]);
  for (const f of ranges) {
    bounds.add(Math.max(0, Math.min(len, f.start!)));
    bounds.add(Math.max(0, Math.min(len, f.end!)));
  }
  for (const s of liveRanges) {
    bounds.add(Math.max(0, Math.min(len, s.start)));
    bounds.add(Math.max(0, Math.min(len, s.end)));
  }
  const points = [...bounds].sort((a, b) => a - b);

  const segs: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (b <= a) continue;
    let severity: Severity | undefined;
    let isActive = false;
    for (const f of ranges) {
      if (f.start! <= a && f.end! >= b) {
        if (
          severity === undefined ||
          SEVERITY_ORDER[f.severity] < SEVERITY_ORDER[severity]
        ) {
          severity = f.severity;
        }
        if (active && f === active) isActive = true;
      }
    }
    const isLive = liveRanges.some((s) => s.start <= a && s.end >= b);
    segs.push({ text: text.slice(a, b), severity, active: isActive, live: isLive });
  }
  return segs;
}

export function HighlightedEditor({
  value,
  onChange,
  findings,
  active,
  liveHighlights = [],
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Findings to highlight; pass [] to disable (e.g. when text is stale). */
  findings: Finding[];
  active: Finding | null;
  /** Always-on highlights computed from the live text (e.g. pronoun openers). */
  liveHighlights?: Span[];
  placeholder?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const bdRef = useRef<HTMLDivElement>(null);
  const activeMarkRef = useRef<HTMLElement | null>(null);

  const segments = useMemo(
    () => buildSegments(value, findings, liveHighlights, active),
    [value, findings, liveHighlights, active],
  );
  const firstActiveIndex = useMemo(
    () => segments.findIndex((s) => s.active),
    [segments],
  );

  function syncScroll(e: UIEvent<HTMLTextAreaElement>) {
    const bd = bdRef.current;
    if (!bd) return;
    bd.scrollTop = e.currentTarget.scrollTop;
    bd.scrollLeft = e.currentTarget.scrollLeft;
  }

  // Center the active finding by measuring its mark in the backdrop (which
  // shares the textarea's geometry). No focus stealing, no native selection.
  useEffect(() => {
    const ta = taRef.current;
    const bd = bdRef.current;
    const mark = activeMarkRef.current;
    if (!ta || !bd || !active || !mark) return;
    const target = Math.max(
      0,
      mark.offsetTop - ta.clientHeight / 2 + mark.offsetHeight / 2,
    );
    ta.scrollTop = target;
    bd.scrollTop = target;
    bd.scrollLeft = ta.scrollLeft;
  }, [active, firstActiveIndex]);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        ref={bdRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden text-transparent"
        style={SHARED_TEXT}
      >
        {segments.map((seg, i) => {
          // Findings take visual priority over live highlights on overlap.
          if (!seg.severity && !seg.live) return <span key={i}>{seg.text}</span>;
          const isActive = seg.active;
          const fill = seg.severity
            ? isActive
              ? SEVERITY_FILL[seg.severity].replace(/[\d.]+\)$/, "0.45)")
              : SEVERITY_FILL[seg.severity]
            : LIVE_FILL;
          const line = seg.severity ? SEVERITY_LINE[seg.severity] : LIVE_LINE;
          return (
            <mark
              key={i}
              ref={
                i === firstActiveIndex
                  ? (el) => {
                      activeMarkRef.current = el;
                    }
                  : undefined
              }
              style={{
                backgroundColor: fill,
                color: "transparent",
                borderBottom: `2px solid ${line}`,
                borderRadius: 2,
                boxShadow: isActive
                  ? "0 0 0 2px rgba(180, 83, 9, 0.95)"
                  : undefined,
              }}
            >
              {seg.text}
            </mark>
          );
        })}
        {/* trailing newline guard so heights match when text ends in \n */}
        {"\n"}
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        placeholder={placeholder}
        spellCheck
        className="absolute inset-0 resize-none overflow-auto bg-transparent text-stone-800 caret-stone-800 outline-none placeholder:text-stone-400"
        style={SHARED_TEXT}
      />
    </div>
  );
}
