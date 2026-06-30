// Live editor highlights computed directly from the current text (independent
// of running an analysis). Currently: every pronoun that opens a sentence.

import { pronounBase } from "./text";

export interface Span {
  start: number;
  end: number;
}

// Pronouns (personal, possessive, reflexive, demonstrative, relative). "there"
// and "here" are excluded — they're adverbs, not pronouns.
const SENTENCE_PRONOUNS = new Set([
  "i", "me", "my", "mine", "myself",
  "you", "your", "yours", "yourself", "yourselves",
  "he", "him", "his", "himself",
  "she", "her", "hers", "herself",
  "it", "its", "itself",
  "we", "us", "our", "ours", "ourselves",
  "they", "them", "their", "theirs", "themselves",
  "this", "that", "these", "those",
  "who", "whom", "whose", "which", "what",
]);

/**
 * Spans for the first word of each sentence when that word is a pronoun. A
 * sentence start is the beginning of the text, the position after a terminal
 * mark (. ? !) and any closing quote/bracket, or the start of a new line.
 * Contractions count via their base ("They’re"/"It’s" → they/it).
 */
export function sentenceInitialPronounSpans(text: string): Span[] {
  const re = /(^|[.!?]["'”’)\]]*\s+|\n+[^\S\n]*)([A-Za-z][A-Za-z'’]*)/g;
  const out: Span[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const word = m[2];
    if (SENTENCE_PRONOUNS.has(pronounBase(word))) {
      const start = m.index + m[1].length;
      out.push({ start, end: start + word.length });
    }
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}
