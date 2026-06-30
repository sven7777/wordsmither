// Deterministic rules: pure, isomorphic functions over the text. These run
// client-side — instant and free, no API. Two tiers:
//
//   1. MECHANICS (cross-guide): high-precision, on by default. Things every
//      style guide agrees on — double spaces, repeated words, etc.
//   2. STYLE (per guide): genuinely useful but context-blind, so off by
//      default and marked heuristic. Number style can't distinguish prose from
//      dates/ages/stats; serial-comma detection can't distinguish a list from a
//      compound sentence. Enable the ones for the guide you're writing for.

import nlp from "compromise";
import type { RawFinding, Rule, RuleSetId } from "./types";
import { pronounBase, tokenizeWords } from "../text";

const MAX_FINDINGS_PER_RULE = 100;
const CONTEXT_RADIUS = 24;

/** Run a global regex over the text, building a partial RawFinding per match. */
function scan(
  text: string,
  regex: RegExp,
  build: (match: RegExpExecArray) => Omit<RawFinding, "ruleId">,
): Omit<RawFinding, "ruleId">[] {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  const re = new RegExp(regex.source, flags);
  const out: Omit<RawFinding, "ruleId">[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(build(m));
    if (m.index === re.lastIndex) re.lastIndex++;
    if (out.length >= MAX_FINDINGS_PER_RULE) break;
  }
  return out;
}

/** A short readable window of context around a span, marking the match. */
function context(text: string, start: number, end: number): string {
  const from = Math.max(0, start - CONTEXT_RADIUS);
  const to = Math.min(text.length, end + CONTEXT_RADIUS);
  const prefix = from > 0 ? "…" : "";
  const suffix = to < text.length ? "…" : "";
  const before = text.slice(from, start);
  const match = text.slice(start, end);
  const after = text.slice(end, to);
  return `${prefix}${before}⟦${match}⟧${after}${suffix}`
    .replace(/\n/g, "↵")
    .replace(/\t/g, "→");
}

const tag =
  (ruleId: string) =>
  (f: Omit<RawFinding, "ruleId">): RawFinding => ({ ...f, ruleId });

// --- number-to-words (0–100), for spell-out suggestions ----------------------

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty",
  "ninety",
];

function numberToWords(n: number): string | null {
  if (n < 0) return null;
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o ? `${TENS[t]}-${ONES[o]}` : TENS[t];
  }
  if (n === 100) return "one hundred";
  return null;
}

// --- shared style detectors --------------------------------------------------

/**
 * Flag integer numerals that a guide would spell out (value 1..maxSpellOut).
 * Conservatively skips money ($5), percentages (5%), times (5:30), decimals,
 * ordinals (5th), and thousands-grouped/large numbers.
 */
function flagSpellOutNumbers(
  text: string,
  maxSpellOut: number,
  ruleId: string,
  guideNote: string,
): RawFinding[] {
  // Lookbehind excludes word chars, currency, '#', decimals, and ':' (times,
  // ratios) so the trailing half of "5:30" isn't treated as a standalone number.
  const re = /(?<![\w$£€#.:])\d[\d,]*(?:\.\d+)?/g;
  const out: RawFinding[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const start = m.index;
    const end = start + raw.length;
    const after = text[end] ?? "";
    if (raw.includes(".")) continue; // decimal
    if (after === "%" || after === ":") continue; // percentage / time
    if (/[\w]/.test(after)) continue; // 5th, 5km, etc.
    const value = parseInt(raw.replace(/,/g, ""), 10);
    if (Number.isNaN(value) || value < 1 || value > maxSpellOut) continue;
    const word = numberToWords(value);
    out.push({
      ruleId,
      message: `${guideNote} Consider spelling out "${raw}".`,
      snippet: context(text, start, end),
      start,
      end,
      suggestion: word ?? undefined,
    });
    if (out.length >= MAX_FINDINGS_PER_RULE) break;
  }
  return out;
}

/** Start index of the sentence containing `idx` (after the last . ? ! or newline). */
function sentenceStart(text: string, idx: number): number {
  let i = idx - 1;
  while (i >= 0 && !".?!\n".includes(text[i])) i--;
  return i + 1;
}

/**
 * Flag a serial (Oxford) comma: a comma directly before a final coordinating
 * conjunction, when an earlier comma in the same sentence signals a real list.
 * Heuristic — may flag compound sentences that open with an introductory clause.
 */
function flagSerialCommaPresent(text: string, ruleId: string): RawFinding[] {
  return scan(text, /,(\s+)(and|or|nor)\b/gi, (m) => {
    const start = m.index;
    const end = start + m[0].length;
    const sStart = sentenceStart(text, start);
    const before = text.slice(sStart, start);
    if (!before.includes(",")) return null as unknown as Omit<RawFinding, "ruleId">;
    return {
      message:
        "Serial (Oxford) comma before the final conjunction; AP omits it in a simple series.",
      snippet: context(text, start, end),
      start,
      end,
    };
  })
    .filter((f) => f !== null)
    .map(tag(ruleId));
}

// Pronouns counted for density and per-sentence repetition (personal + possessive).
const COUNT_PRONOUNS = new Set([
  "i", "me", "my", "mine", "myself",
  "you", "your", "yours", "yourself", "yourselves",
  "he", "him", "his", "himself",
  "she", "her", "hers", "herself",
  "it", "its", "itself",
  "we", "us", "our", "ours", "ourselves",
  "they", "them", "their", "theirs", "themselves",
]);

// Subject/demonstrative pronouns that count as sentence openers.
const OPENER_PRONOUNS = new Set([
  "i", "you", "he", "she", "it", "we", "they",
  "this", "that", "these", "those", "there",
]);

// Third-person subject pronouns (the "too many she/he/it/they" lens).
const THIRD_PERSON_SUBJECT = new Set(["he", "she", "it", "they"]);

// Tunable thresholds for the pronoun-overuse rule.
const PRONOUN_DENSITY_THRESHOLD = 0.18; // A1: > 18% of all words are pronouns
const THIRD_PERSON_DENSITY_THRESHOLD = 0.06; // A2: > 6% of words are he/she/it/they
const OPENER_SHARE_THRESHOLD = 0.4; // A3: > 40% of sentences open with a pronoun
const OPENER_MIN_SENTENCES = 5; // skip A3 on very short text
const SAME_OPENER_RUN = 3; // B: > 2 consecutive sentences, same opener pronoun
const HEAVY_SENTENCE_REPEATS = 3; // C: a pronoun used > 2 times in one sentence
const HEAVY_SENTENCE_RUN = 3; // C: for 3 such sentences in a row
const DENSITY_MIN_WORDS = 50; // skip density checks on very short text

interface Sentence {
  text: string;
  start: number;
  end: number;
}

function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const re = /[^.!?\n]+[.!?]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const chunk = m[0];
    if (!chunk.trim()) continue;
    const lead = chunk.length - chunk.trimStart().length;
    const trimmed = chunk.trim();
    const start = m.index + lead;
    out.push({ text: trimmed, start, end: start + trimmed.length });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

function firstWord(sentence: string): string | null {
  const m = sentence.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/);
  return m ? m[0] : null;
}

function pronounCounts(sentence: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tok of tokenizeWords(sentence)) {
    const base = pronounBase(tok);
    if (COUNT_PRONOUNS.has(base)) counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  return counts;
}

function excerpt(text: string, start: number, end: number, max = 80): string {
  const slice = text
    .slice(start, Math.min(end, start + max))
    .replace(/\s+/g, " ");
  return `"${slice}${end - start > max ? "…" : ""}"`;
}

/**
 * Pronoun-overuse rule. Quiet on ordinary prose (pronoun openers are normal in
 * fiction) — warns only when usage is excessive on one of three measures:
 *   A. pronouns exceed PRONOUN_DENSITY_THRESHOLD of all words;
 *   B. SAME_OPENER_RUN+ consecutive sentences open with the same pronoun;
 *   C. HEAVY_SENTENCE_RUN+ consecutive sentences each repeat one pronoun
 *      HEAVY_SENTENCE_REPEATS+ times.
 */
function flagPronounOveruse(text: string, ruleId: string): RawFinding[] {
  const out: RawFinding[] = [];
  const sentences = splitSentences(text);

  // Shared word + opener tallies.
  const wordTokens = tokenizeWords(text);
  const total = wordTokens.length;
  const openers = sentences.map((s) => {
    const w = firstWord(s.text);
    return w ? pronounBase(w) : null;
  });
  let pronouns = 0;
  let thirdPerson = 0;
  for (const tok of wordTokens) {
    const base = pronounBase(tok);
    if (COUNT_PRONOUNS.has(base)) pronouns++;
    if (THIRD_PERSON_SUBJECT.has(base)) thirdPerson++;
  }

  // A1 — overall pronoun density (all personal/possessive pronouns).
  if (total >= DENSITY_MIN_WORDS && pronouns / total > PRONOUN_DENSITY_THRESHOLD) {
    const pct = ((pronouns / total) * 100).toFixed(1);
    out.push({
      ruleId,
      message: `Pronouns are ${pct}% of the text (${pronouns} of ${total} words), above the ${PRONOUN_DENSITY_THRESHOLD * 100}% threshold. Vary subjects to lean less on pronouns.`,
      snippet: `${pronouns} of ${total} words are pronouns`,
    });
  }

  // A2 — third-person subject pronoun density (he/she/it/they).
  if (
    total >= DENSITY_MIN_WORDS &&
    thirdPerson / total > THIRD_PERSON_DENSITY_THRESHOLD
  ) {
    const pct = ((thirdPerson / total) * 100).toFixed(1);
    out.push({
      ruleId,
      message: `Third-person subject pronouns (he/she/it/they) are ${pct}% of the text (${thirdPerson} of ${total} words), above the ${THIRD_PERSON_DENSITY_THRESHOLD * 100}% threshold.`,
      snippet: `${thirdPerson} of ${total} words are he/she/it/they`,
    });
  }

  // A3 — share of sentences that open with a pronoun.
  const openerSentences = openers.filter(
    (o) => o !== null && OPENER_PRONOUNS.has(o),
  ).length;
  if (
    sentences.length >= OPENER_MIN_SENTENCES &&
    openerSentences / sentences.length > OPENER_SHARE_THRESHOLD
  ) {
    const pct = ((openerSentences / sentences.length) * 100).toFixed(0);
    out.push({
      ruleId,
      message: `${pct}% of sentences (${openerSentences} of ${sentences.length}) begin with a pronoun, above the ${OPENER_SHARE_THRESHOLD * 100}% guideline. Vary your sentence openings.`,
      snippet: `${openerSentences} of ${sentences.length} sentences start with a pronoun`,
    });
  }

  // B — same opener pronoun in a row.
  for (let i = 0; i < sentences.length; ) {
    const cur = openers[i];
    if (cur && OPENER_PRONOUNS.has(cur)) {
      let j = i + 1;
      while (j < sentences.length && openers[j] === cur) j++;
      const runLen = j - i;
      if (runLen >= SAME_OPENER_RUN) {
        const start = sentences[i].start;
        const end = sentences[j - 1].end;
        const word = firstWord(sentences[i].text) ?? cur;
        out.push({
          ruleId,
          message: `${runLen} sentences in a row begin with "${word}". Vary your sentence openings.`,
          snippet: excerpt(text, start, end),
          start,
          end,
        });
      }
      i = j;
    } else {
      i++;
    }
  }

  // C — pronoun-heavy sentences in a row.
  const heavy = sentences.map((s) => {
    let top: string | null = null;
    let max = 0;
    for (const [p, c] of pronounCounts(s.text))
      if (c > max) {
        max = c;
        top = p;
      }
    return { top, max };
  });
  for (let i = 0; i < sentences.length; ) {
    if (heavy[i].max >= HEAVY_SENTENCE_REPEATS) {
      let j = i + 1;
      while (j < sentences.length && heavy[j].max >= HEAVY_SENTENCE_REPEATS) j++;
      const runLen = j - i;
      if (runLen >= HEAVY_SENTENCE_RUN) {
        const start = sentences[i].start;
        const end = sentences[j - 1].end;
        const desc = heavy
          .slice(i, j)
          .map((h) => `"${h.top}"×${h.max}`)
          .join(", ");
        out.push({
          ruleId,
          message: `${runLen} sentences in a row each repeat a pronoun 3+ times (${desc}). Consider varying.`,
          snippet: excerpt(text, start, end),
          start,
          end,
        });
      }
      i = j;
    } else {
      i++;
    }
  }

  return out;
}

// Match the replacement's capitalization to the offending word.
function matchCase(target: string, base: string): string {
  const c = target.charAt(0);
  if (c && c === c.toUpperCase() && c !== c.toLowerCase()) {
    return base.charAt(0).toUpperCase() + base.slice(1);
  }
  return base;
}

interface HomophonePattern {
  re: RegExp;
  base: string;
  message: string;
  // Capture group holding the word to flag/replace (default 2). Each pattern's
  // groups must partition the whole match: (prefix)(target)(suffix).
  targetGroup?: number;
}

// Curated, high-confidence confusion patterns only. Each requires enough
// surrounding context to be reasonably sure the homophone is wrong.
const COMPARATIVES =
  "more|less|fewer|greater|better|worse|rather|other|sooner|later|faster|slower|bigger|smaller|larger|longer|shorter|higher|lower|older|younger|harder|easier|stronger|weaker|taller|nicer|closer";

// Words that, following an -ing verb, mark it as a verb (object/complement)
// rather than a possessed gerund-noun. "their having A great day" → they're,
// but "their cooking WAS great" (followed by a verb) stays untouched.
const HOMO_OBJECTS = "a|an|the|me|you|him|her|them|us|it|so|very|really|too";

const HOMOPHONE_PATTERNS: HomophonePattern[] = [
  // their → there (before a be-verb)
  {
    re: /(\b)(their)(\s+(?:is|are|was|were)\b)/i,
    base: "there",
    message: '"their" before a verb — likely "there".',
  },
  // their → they're (before common verbs/adverbs that follow "they are")
  {
    re: /(\b)(their)(\s+(?:going|gonna|coming|trying|getting|doing|already|always|never|not|here)\b)/i,
    base: "they're",
    message: '"their" where "they are" is meant — likely "they’re".',
  },
  // there → they're
  {
    re: /(\b)(there)(\s+(?:going|gonna|coming|trying|not)\b)/i,
    base: "they're",
    message: '"there" where "they are" is meant — likely "they’re".',
  },
  // their/there/your + (-ing verb) + (object) → contraction
  // e.g. "their having a great day" → they're; "your making a mess" → you're
  {
    re: new RegExp(`(\\b)(their)(\\s+\\w+ing\\s+(?:${HOMO_OBJECTS})\\b)`, "i"),
    base: "they're",
    message: '"their" before an action verb — likely "they’re".',
  },
  {
    re: new RegExp(`(\\b)(there)(\\s+\\w+ing\\s+(?:${HOMO_OBJECTS})\\b)`, "i"),
    base: "they're",
    message: '"there" before an action verb — likely "they’re".',
  },
  {
    re: new RegExp(`(\\b)(your)(\\s+\\w+ing\\s+(?:${HOMO_OBJECTS})\\b)`, "i"),
    base: "you're",
    message: '"your" before an action verb — likely "you’re".',
  },
  // your → you're
  {
    re: /(\b)(your)(\s+(?:welcome|right|wrong|going|gonna|coming|trying|kidding|correct|not|so|very|too|really|the|a|an)\b)/i,
    base: "you're",
    message: '"your" where "you are" is meant — likely "you’re".',
  },
  // (you're → your is handled by flagYoureBeforeNoun, below, using POS tagging)
  // its → it's
  {
    re: /(\b)(its)(\s+(?:been|going|gonna|getting|a|an|the|not|so|very|too|just|raining|snowing|over|here|true|okay|ok|fine|important|because)\b)/i,
    base: "it's",
    message: '"its" where "it is/has" is meant — likely "it’s".',
  },
  // it's → its (possessive)
  {
    re: /(\b)(it['’]s)(\s+own\b)/i,
    base: "its",
    message: '"it’s own" — the possessive is "its".',
  },
  // to → too (before a few adjectives/adverbs)
  {
    re: /(\b)(to)(\s+(?:much|late|early|soon|often|hard|tight|loud)\b)/i,
    base: "too",
    message: '"to" before an adjective/adverb — likely "too".',
  },
  // comparative + then → than
  {
    re: new RegExp(`(\\b(?:${COMPARATIVES}))(\\s+)(then)\\b`, "i"),
    base: "than",
    message: 'comparison with "then" — likely "than".',
    targetGroup: 3,
  },
  // modal + of → have
  {
    re: /(\b(?:could|should|would|must|might))(\s+)(of)\b/i,
    base: "have",
    message: '"of" after a modal — likely "have" (e.g. "could have").',
    targetGroup: 3,
  },
  // loose → lose (used as a verb)
  {
    re: /(\b(?:don['’]t|to|will|can|could|would|might|may|never|always|not)\s+)(loose)\b/i,
    base: "lose",
    message: '"loose" used as a verb — likely "lose".',
  },
  // affect → effect (used as a noun)
  {
    re: /(\b(?:the|an|any|some|this|that|positive|negative|side|net)\s+)(affect)(s?\b)/i,
    base: "effect",
    message: '"affect" as a noun — likely "effect".',
  },
  // weather → whether
  {
    re: /(\b)(weather)(\s+or\s+not\b)/i,
    base: "whether",
    message: '"weather or not" — likely "whether".',
  },
];

// Words that legitimately follow "you're" (adjectives/adverbs/fixed phrases)
// and so should never be treated as the possessive case.
const YOURE_OK = new Set([
  "welcome", "right", "sure", "fine", "ok", "okay", "done", "ready", "kidding",
  "correct", "free", "late", "early", "next", "first", "last", "not", "here",
  "there", "so", "very", "really", "too", "just", "always", "never", "gonna",
  "all", "still", "only", "also", "about",
]);

// Determiners/possessives that follow "you're" in valid sentences
// ("you're the best", "you're my hero"). compromise tags some of these as
// nouns, so skip them explicitly.
const DETERMINERS = new Set([
  "a", "an", "the", "my", "his", "her", "its", "our", "their", "your", "this",
  "that", "these", "those", "no", "some", "any", "every", "each", "mine",
  "hers", "ours", "theirs", "much", "many", "more", "most", "few", "several",
]);

/**
 * "you're" → "your" when the following word is a noun. Uses the POS tagger
 * rather than a fixed noun list, so it generalizes (e.g. "you're dolly"). Skips
 * determiners, clear verb forms, and capitalized words (likely a name).
 */
function flagYoureBeforeNoun(text: string, ruleId: string): RawFinding[] {
  const out: RawFinding[] = [];
  const re = /\b(you['’]re)\s+([A-Za-z][A-Za-z'’-]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const next = m[2];
    const lower = next.toLowerCase();
    const skip =
      /^[A-Z]/.test(next) || // proper noun / name ("you're Dolly")
      YOURE_OK.has(lower) ||
      DETERMINERS.has(lower) ||
      /(?:ing|ed)$/.test(lower); // clear verb forms
    if (!skip) {
      const d = nlp(next);
      const isNoun = d.has("#Noun");
      const isOther =
        d.has("#Verb") ||
        d.has("#Adjective") ||
        d.has("#Adverb") ||
        d.has("#Pronoun") ||
        d.has("#Preposition") ||
        d.has("#Determiner") ||
        d.has("#Conjunction") ||
        d.has("#Value");
      if (isNoun && !isOther) {
        const start = m.index;
        const end = start + m[1].length;
        out.push({
          ruleId,
          message: '"you’re" before a noun — likely the possessive "your".',
          snippet: context(text, start, end),
          start,
          end,
          suggestion: matchCase(m[1], "your"),
        });
      }
    }
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

function flagHomophones(text: string, ruleId: string): RawFinding[] {
  const out: RawFinding[] = flagYoureBeforeNoun(text, ruleId);
  for (const p of HOMOPHONE_PATTERNS) {
    const re = new RegExp(p.re.source, "gi");
    const tg = p.targetGroup ?? 2;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      let off = 0;
      for (let g = 1; g < tg; g++) off += (m[g] ?? "").length;
      const start = m.index + off;
      const target = m[tg] ?? "";
      const end = start + target.length;
      out.push({
        ruleId,
        message: p.message,
        snippet: context(text, start, end),
        start,
        end,
        suggestion: matchCase(target, p.base),
      });
      if (m.index === re.lastIndex) re.lastIndex++;
      if (out.length >= MAX_FINDINGS_PER_RULE) break;
    }
  }
  // Dedupe: a word may match more than one pattern (e.g. the adverb list and
  // the gerund+object pattern). Keep one finding per span.
  const seen = new Set<string>();
  return out
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
    .filter((f) => {
      const k = `${f.start}:${f.end}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

// Flag spaces around an em dash (—). This project's style closes them up.
function flagEmDashSpacing(text: string, ruleId: string): RawFinding[] {
  return scan(text, /[^\S\n]*—[^\S\n]*/g, (m) => {
    if (!/\s/.test(m[0])) {
      return null as unknown as Omit<RawFinding, "ruleId">;
    }
    const start = m.index;
    const end = start + m[0].length;
    return {
      message: "Em dash should be closed up — no spaces before or after.",
      snippet: context(text, start, end),
      start,
      end,
      suggestion: "—",
    };
  })
    .filter((f) => f !== null)
    .map(tag(ruleId));
}

// Flag ellipsis spacing: spaced-out periods (". . ."), and a missing space
// after an ellipsis that's jammed against the following word.
function flagEllipsisSpacing(text: string, ruleId: string): RawFinding[] {
  const spaced = scan(text, /\.(?:[^\S\n]+\.){2,}/g, (m) => {
    const start = m.index;
    const end = start + m[0].length;
    return {
      message: "Use an unspaced ellipsis (…) instead of spaced periods.",
      snippet: context(text, start, end),
      start,
      end,
      suggestion: "…",
    };
  }).map(tag(ruleId));

  const jammed = scan(text, /(\.\.\.|…)(?=[A-Za-z])/g, (m) => {
    const start = m.index;
    const end = start + m[1].length;
    return {
      message: "Add a space after the ellipsis.",
      snippet: context(text, start, end),
      start,
      end,
      suggestion: `${m[1]} `,
    };
  }).map(tag(ruleId));

  return [...spaced, ...jammed];
}

// --- MECHANICS (cross-guide, default ON) -------------------------------------

const mechanicsRules: Rule[] = [
  {
    id: "mech.double-space",
    name: "Multiple consecutive spaces",
    description:
      "Two or more spaces in a row (including two spaces after a period). All major guides use a single space.",
    ruleSet: "mechanics",
    severity: "warning",
    defaultEnabled: true,
    check: (text) =>
      scan(text, /[^\S\n]{2,}/g, (m) => {
        const start = m.index;
        const end = start + m[0].length;
        return {
          message: `${m[0].length} consecutive spaces; use a single space.`,
          snippet: context(text, start, end),
          start,
          end,
          suggestion: " ",
        };
      }).map(tag("mech.double-space")),
  },
  {
    id: "mech.repeated-word",
    name: "Repeated word",
    description:
      'The same word twice in a row (e.g. "the the"). Occasionally valid ("had had"), so review each.',
    ruleSet: "mechanics",
    severity: "suggestion",
    defaultEnabled: true,
    check: (text) =>
      scan(text, /\b(\w+)\s+\1\b/gi, (m) => {
        const start = m.index;
        const end = start + m[0].length;
        return {
          message: `Repeated word "${m[1]}".`,
          snippet: context(text, start, end),
          start,
          end,
          suggestion: m[1],
        };
      }).map(tag("mech.repeated-word")),
  },
  {
    id: "mech.ampersand",
    name: "Ampersand in prose",
    description:
      'An "&" used as a word in running text. Use "and" except in names and titles that use it.',
    ruleSet: "mechanics",
    severity: "suggestion",
    defaultEnabled: true,
    check: (text) =>
      scan(text, /\s(&)\s/g, (m) => {
        const start = m.index + m[0].indexOf("&");
        const end = start + 1;
        return {
          message: 'Use "and" instead of "&" in running text.',
          snippet: context(text, start, end),
          start,
          end,
          suggestion: "and",
        };
      }).map(tag("mech.ampersand")),
  },
  {
    id: "mech.repeated-punctuation",
    name: "Repeated punctuation",
    description:
      "Runs of repeated ! or ? (e.g. '!!!', '?!'). Use a single mark in formal writing.",
    ruleSet: "mechanics",
    severity: "suggestion",
    defaultEnabled: true,
    check: (text) =>
      scan(text, /[!?]{2,}/g, (m) => {
        const start = m.index;
        const end = start + m[0].length;
        return {
          message: `Repeated punctuation "${m[0]}".`,
          snippet: context(text, start, end),
          start,
          end,
        };
      }).map(tag("mech.repeated-punctuation")),
  },
  {
    id: "mech.space-before-punctuation",
    name: "Space before punctuation",
    description:
      "Whitespace before a comma, semicolon, colon, or terminal mark.",
    ruleSet: "mechanics",
    severity: "warning",
    defaultEnabled: true,
    check: (text) =>
      scan(text, /[^\S\n]+([,;:!?])/g, (m) => {
        const start = m.index;
        const end = start + m[0].length;
        return {
          message: `Remove the space before "${m[1]}".`,
          snippet: context(text, start, end),
          start,
          end,
          suggestion: m[1],
        };
      }).map(tag("mech.space-before-punctuation")),
  },
  {
    id: "mech.missing-space-after-punctuation",
    name: "Missing space after punctuation",
    description:
      "A comma, semicolon, or colon immediately followed by a letter (e.g. 'one,two').",
    ruleSet: "mechanics",
    severity: "warning",
    defaultEnabled: true,
    check: (text) =>
      scan(text, /([,;:])(?=[A-Za-z])/g, (m) => {
        const start = m.index;
        const end = start + m[0].length;
        return {
          message: `Add a space after "${m[1]}".`,
          snippet: context(text, start, end),
          start,
          end,
          suggestion: `${m[1]} `,
        };
      }).map(tag("mech.missing-space-after-punctuation")),
  },
  {
    id: "mech.straight-quotes",
    name: "Straight quotation marks",
    description:
      'Straight (") quotes instead of typographic “curly” quotes. Publishers (Chicago) prefer curly quotes.',
    ruleSet: "mechanics",
    severity: "suggestion",
    defaultEnabled: true,
    check: (text) =>
      scan(text, /"/g, (m) => {
        const start = m.index;
        const end = start + m[0].length;
        return {
          message: "Straight double quote; consider a typographic curly quote.",
          snippet: context(text, start, end),
          start,
          end,
        };
      }).map(tag("mech.straight-quotes")),
  },
];

// --- STYLE (per guide, default OFF — heuristic, context-blind) ---------------

function numberRule(
  ruleSet: RuleSetId,
  id: string,
  maxSpellOut: number,
  thresholdLabel: string,
): Rule {
  return {
    id,
    name: "Spell out small numbers",
    description: `Heuristic: flags numerals ${thresholdLabel} that this guide spells out. May misfire on dates, ages, and statistics, which take numerals. Off by default.`,
    ruleSet,
    severity: "suggestion",
    defaultEnabled: false,
    check: (text) =>
      flagSpellOutNumbers(
        text,
        maxSpellOut,
        id,
        `${ruleSet} spells out numbers ${thresholdLabel}.`,
      ),
  };
}

const styleRules: Rule[] = [
  // AP: spell out one–nine; numerals for 10+. AP omits the serial comma.
  numberRule("AP", "ap.spell-out-numbers", 9, "below 10"),
  {
    id: "ap.serial-comma",
    name: "Serial (Oxford) comma",
    description:
      "Heuristic: flags a serial comma before the final conjunction (AP omits it). May misfire on compound sentences with an introductory clause. Off by default.",
    ruleSet: "AP",
    severity: "suggestion",
    defaultEnabled: false,
    check: (text) => flagSerialCommaPresent(text, "ap.serial-comma"),
  },
  // Chicago: spell out zero–one hundred (non-technical prose).
  numberRule("Chicago", "chicago.spell-out-numbers", 100, "up to one hundred"),
  // APA: spell out below 10; numerals for 10+.
  numberRule("APA", "apa.spell-out-numbers", 9, "below 10"),
  // MLA: spell out numbers expressible in one or two words (≈ 1–100).
  numberRule("MLA", "mla.spell-out-numbers", 100, "expressible in one or two words"),
];

// --- CUSTOM (project-specific rules we add over time) ------------------------

const customRules: Rule[] = [
  {
    id: "custom.pronoun-overuse",
    name: "Pronoun overuse",
    description:
      "Warns only when pronoun use is excessive: pronouns >18% of words, he/she/it/they >6% of words, >40% of sentences opening with a pronoun, 3+ consecutive sentences opening with the same pronoun, or 3+ sentences in a row each repeating a pronoun 3+ times.",
    ruleSet: "custom",
    severity: "warning",
    defaultEnabled: true,
    check: (text) => flagPronounOveruse(text, "custom.pronoun-overuse"),
  },
  {
    id: "custom.homophones",
    name: "Homophones",
    description:
      "Flags commonly confused homophones used incorrectly (their/there/they’re, your/you’re, its/it’s, to/too, then/than, lose/loose, affect/effect, could-of→have, weather/whether). Heuristic — high-confidence patterns only; subtle cases still need a human eye.",
    ruleSet: "custom",
    severity: "suggestion",
    defaultEnabled: true,
    check: (text) => flagHomophones(text, "custom.homophones"),
  },
  {
    id: "custom.em-dash-spacing",
    name: "Em dash spacing",
    description:
      "Flags spaces around an em dash (—); they should be closed up with no spaces before or after.",
    ruleSet: "custom",
    severity: "suggestion",
    defaultEnabled: true,
    check: (text) => flagEmDashSpacing(text, "custom.em-dash-spacing"),
  },
  {
    id: "custom.ellipsis-spacing",
    name: "Ellipsis spacing",
    description:
      "Flags spaced-out periods (use an unspaced “…”) and a missing space after an ellipsis that runs into the next word.",
    ruleSet: "custom",
    severity: "suggestion",
    defaultEnabled: true,
    check: (text) => flagEllipsisSpacing(text, "custom.ellipsis-spacing"),
  },
];

// --- exports -----------------------------------------------------------------

export const deterministicRules: Rule[] = [
  ...mechanicsRules,
  ...styleRules,
  ...customRules,
];

/** Run every enabled deterministic rule and return raw findings. */
export function runDeterministic(
  text: string,
  isEnabled: (ruleId: string) => boolean,
): RawFinding[] {
  const out: RawFinding[] = [];
  for (const rule of deterministicRules) {
    if (!isEnabled(rule.id)) continue;
    out.push(...rule.check(text));
  }
  return out;
}
