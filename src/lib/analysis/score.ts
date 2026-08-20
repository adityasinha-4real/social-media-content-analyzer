import type { Metrics, PlatformFitResult, PlatformId, ScoreBreakdown } from '../../types';
import { PLATFORM_LIMITS } from './platforms';
import { hasCta } from './suggestions';

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Weighted composite out of 100: length fit 25, CTA presence 20, hashtag
 * usage 15, readability 15, structure 10, hook quality 15. This is a
 * heuristic composite, not a trained model.
 */
export function computeScore(
  text: string,
  metrics: Metrics,
  platform: PlatformId,
  fit: PlatformFitResult,
): ScoreBreakdown {
  const limits = PLATFORM_LIMITS[platform];

  let lengthFit = 25;
  if (fit.lengthVerdict === 'over') lengthFit = 0;
  else if (fit.lengthVerdict === 'short') lengthFit = 12;
  else if (fit.lengthVerdict === 'long') lengthFit = 18;

  const cta = hasCta(text) ? 20 : 0;

  let hashtags = 15;
  if (fit.hashtagVerdict === 'none') hashtags = 0;
  else if (fit.hashtagVerdict === 'low' || fit.hashtagVerdict === 'high') hashtags = 8;
  else if (fit.hashtagVerdict === 'excessive') hashtags = 4;

  const readability = clamp((metrics.readability.fleschScore / 100) * 15, 0, 15);

  let structure = 10;
  if (metrics.paragraphCount <= 1 && metrics.charCount > 300) structure -= 6;
  if (metrics.hashtags.count > 0 && !metrics.hashtags.trailingBlock) structure -= 2;
  structure = clamp(structure, 0, 10);

  let hook = 15;
  if (limits.truncateAt != null) {
    const firstLine = text.split('\n')[0] ?? '';
    if (firstLine.length > limits.truncateAt) hook = 5;
  }
  if (metrics.questionMarks === 0) hook = clamp(hook - 3, 0, 15);

  const total = Math.round(lengthFit + cta + hashtags + readability + structure + hook);

  return {
    total: clamp(total, 0, 100),
    lengthFit: Math.round(lengthFit),
    cta,
    hashtags,
    readability: Math.round(readability),
    structure: Math.round(structure),
    hook: Math.round(hook),
  };
}
