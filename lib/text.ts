// Shared word tokenizer used by stats, the editor word count, and the rules,
// so every "word count" figure agrees. A word is a run of letters/digits with
// internal apostrophes (straight ' or curly ’) or hyphens — so "I'm", "he’s",
// "well-being", and "2024" each count as one word, and a stray "'" or "—" never
// becomes a word on its own.
export const WORD_RE = /[A-Za-z0-9]+(?:[-'’][A-Za-z0-9]+)*/g;

export function tokenizeWords(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

/**
 * The lead segment of a token before any apostrophe — so "he's" / "I’m" /
 * "that's" reduce to "he" / "i" / "that" for pronoun matching, while a
 * possessive like "dog's" reduces to "dog".
 */
export function pronounBase(token: string): string {
  return token.toLowerCase().split(/['’]/)[0];
}
