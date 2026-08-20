import type { AnalysisResult, PlatformId } from '../../types';
import { computeMetrics } from './metrics';
import { computePlatformFit } from './platforms';
import { computeScore } from './score';
import { computeSuggestions } from './suggestions';

export { PLATFORM_LIMITS, PLATFORM_ORDER } from './platforms';

/** Pure, synchronous: metrics -> platform fit -> suggestions -> score, for one platform. */
export function analyzeText(text: string, platform: PlatformId): AnalysisResult {
  const metrics = computeMetrics(text);
  const platformFit = computePlatformFit(text, metrics);
  const fit = platformFit[platform];
  const suggestions = computeSuggestions(text, metrics, platform, fit);
  const score = computeScore(text, metrics, platform, fit);

  return { metrics, platformFit, suggestions, score };
}
