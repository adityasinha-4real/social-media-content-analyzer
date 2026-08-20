import type { ReadabilityInfo } from '../../types';

/** Rough syllable estimate: counts vowel-sound groups, trims a trailing silent "e". */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  const matches = w.match(/[aeiouy]+/g);
  let count = matches ? matches.length : 1;
  if (w.endsWith('e') && count > 1) count -= 1;
  return Math.max(1, count);
}

function gradeBandFor(score: number): string {
  if (score >= 90) return 'Very easy (5th grade)';
  if (score >= 80) return 'Easy (6th grade)';
  if (score >= 70) return 'Fairly easy (7th grade)';
  if (score >= 60) return 'Standard (8th-9th grade)';
  if (score >= 50) return 'Fairly difficult (10th-12th grade)';
  if (score >= 30) return 'Difficult (college)';
  return 'Very difficult (college graduate)';
}

/** Flesch Reading Ease over a pre-tokenised word list. */
export function computeReadability(words: string[], sentenceCount: number): ReadabilityInfo {
  const wordCount = words.length;
  if (wordCount === 0 || sentenceCount === 0) {
    return { fleschScore: 0, gradeBand: gradeBandFor(0) };
  }

  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const raw =
    206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllables / wordCount);
  const fleschScore = Math.max(0, Math.min(100, raw));

  return { fleschScore, gradeBand: gradeBandFor(fleschScore) };
}
