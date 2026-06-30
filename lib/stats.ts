// Local, free statistics about a piece. Word count, frequency, and pronoun
// share are exact (closed-set / counting); adverb and adjective shares use the
// `compromise` POS tagger (approximate, but runs in-browser at no cost).

import nlp from "compromise";
import { pronounBase, tokenizeWords } from "./text";

// All pronouns, regardless of sentence position (personal, possessive,
// reflexive, demonstrative, relative/interrogative).
const PRONOUNS = new Set([
  "i", "me", "my", "mine", "myself",
  "you", "your", "yours", "yourself", "yourselves",
  "he", "him", "his", "himself",
  "she", "her", "hers", "herself",
  "it", "its", "itself",
  "we", "us", "our", "ours", "ourselves",
  "they", "them", "their", "theirs", "themselves",
  "this", "that", "these", "those",
  "who", "whom", "whose", "which", "what",
  "whoever", "whomever", "whichever", "whatever",
]);

// Common function words to optionally hide from the frequency list so the
// meaningful repeats surface.
export const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "nor", "for", "so", "yet",
  "of", "to", "in", "on", "at", "by", "with", "from", "as", "into",
  "is", "was", "are", "were", "be", "been", "being", "am",
  "do", "does", "did", "have", "has", "had", "having",
  "will", "would", "shall", "should", "can", "could", "may", "might", "must",
  "i", "me", "my", "you", "your", "he", "him", "his", "she", "her", "it",
  "its", "we", "us", "our", "they", "them", "their",
  "this", "that", "these", "those", "there", "here",
  "not", "no", "if", "then", "than", "too", "very", "just", "out", "up",
  "down", "over", "again", "all", "some", "any", "what", "when", "where",
  "who", "how", "which", "while",
]);

export interface WordFreq {
  word: string;
  count: number;
}

export interface Metric {
  count: number;
  pct: number;
}

export interface PieceStats {
  wordCount: number;
  uniqueCount: number;
  pronoun: Metric;
  adverb: Metric;
  adjective: Metric;
  frequency: WordFreq[];
}

function pctOf(n: number, total: number): number {
  return total ? +((n / total) * 100).toFixed(1) : 0;
}

export function computeStats(text: string): PieceStats {
  const tokens = tokenizeWords(text).map((w) => w.toLowerCase());
  const wordCount = tokens.length;

  const freqMap = new Map<string, number>();
  let pronouns = 0;
  for (const t of tokens) {
    freqMap.set(t, (freqMap.get(t) ?? 0) + 1);
    if (PRONOUNS.has(pronounBase(t))) pronouns++;
  }

  const frequency = [...freqMap.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));

  let adjectives = 0;
  let adverbs = 0;
  if (text.trim()) {
    const doc = nlp(text);
    adjectives = doc.adjectives().out("array").length;
    adverbs = doc.adverbs().out("array").length;
  }

  return {
    wordCount,
    uniqueCount: freqMap.size,
    pronoun: { count: pronouns, pct: pctOf(pronouns, wordCount) },
    adverb: { count: adverbs, pct: pctOf(adverbs, wordCount) },
    adjective: { count: adjectives, pct: pctOf(adjectives, wordCount) },
    frequency,
  };
}
