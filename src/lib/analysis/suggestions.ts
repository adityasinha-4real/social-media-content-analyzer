import type { Metrics, PlatformFitResult, PlatformId, Suggestion } from '../../types';
import { PLATFORM_LIMITS } from './platforms';

const CTA_PHRASES = [
  'comment below',
  'link in bio',
  'tag a friend',
  'sign up',
  'learn more',
  'dm me',
  'share this',
  'subscribe',
  'register',
  'download',
  'check out',
  'swipe up',
];

export function hasCta(text: string): boolean {
  const lower = text.toLowerCase();
  return CTA_PHRASES.some((phrase) => lower.includes(phrase));
}

const SEVERITY_ORDER: Record<Suggestion['severity'], number> = { high: 0, medium: 1, low: 2 };

export function computeSuggestions(
  text: string,
  metrics: Metrics,
  platform: PlatformId,
  fit: PlatformFitResult,
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const limits = PLATFORM_LIMITS[platform];

  if (!hasCta(text)) {
    suggestions.push({
      id: 'no-cta',
      severity: 'high',
      title: 'No call to action',
      detail: 'Add a clear next step, e.g. "comment below", "link in bio", or "learn more".',
    });
  }

  if (metrics.questionMarks === 0) {
    suggestions.push({
      id: 'no-question',
      severity: 'medium',
      title: 'No question asked',
      detail: 'Posts that ask a question tend to draw more replies. Consider ending with one.',
    });
  }

  if (limits.truncateAt != null) {
    const firstLine = text.split('\n')[0] ?? '';
    if (firstLine.length > limits.truncateAt) {
      suggestions.push({
        id: 'hook-cut-off',
        severity: 'high',
        title: 'Opening line gets cut off',
        detail: `${limits.name} truncates around ${limits.truncateAt} characters behind "see more". Your first line is ${firstLine.length} characters.`,
        evidence: firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine,
      });
    }
  }

  if (fit.hashtagVerdict === 'none') {
    suggestions.push({
      id: 'no-hashtags',
      severity: 'medium',
      title: 'No hashtags',
      detail: `${limits.name} posts typically use ${limits.hashtagMin}-${limits.hashtagMax} hashtags for discovery.`,
    });
  } else if (fit.hashtagVerdict !== 'good') {
    suggestions.push({
      id: 'hashtag-count',
      severity: 'low',
      title: 'Hashtag count outside the recommended range',
      detail: `${limits.name} works best with ${limits.hashtagMin}-${limits.hashtagMax} hashtags; this post has ${metrics.hashtags.count}.`,
    });
  }

  if (metrics.hashtags.count > 0 && !metrics.hashtags.trailingBlock) {
    suggestions.push({
      id: 'hashtags-scattered',
      severity: 'low',
      title: 'Hashtags scattered inline',
      detail: 'Grouping hashtags at the end reads cleaner and keeps the message the focus.',
    });
  }

  if (metrics.avgWordsPerSentence > 25) {
    suggestions.push({
      id: 'long-sentences',
      severity: 'medium',
      title: 'Sentences run long',
      detail: `Average sentence length is ${metrics.avgWordsPerSentence.toFixed(1)} words. Aim under 25 for easy skimming.`,
    });
  }

  if (metrics.readability.fleschScore < 50) {
    suggestions.push({
      id: 'low-readability',
      severity: 'medium',
      title: 'Hard to skim',
      detail: `Flesch reading ease is ${metrics.readability.fleschScore.toFixed(0)} (${metrics.readability.gradeBand}). Shorter words and sentences read easier on social feeds.`,
    });
  }

  if (metrics.paragraphCount <= 1 && metrics.charCount > 300) {
    suggestions.push({
      id: 'wall-of-text',
      severity: 'medium',
      title: 'Wall of text',
      detail: 'No paragraph break within the first 300 characters. Break it up so it is scannable.',
    });
  }

  if (metrics.emojiCount === 0) {
    suggestions.push({
      id: 'no-emoji',
      severity: 'low',
      title: 'No emoji',
      detail: 'A well-placed emoji or two can boost visual scanability on this platform.',
    });
  }

  if (metrics.urls.count > 0 && metrics.urls.inFirst100) {
    suggestions.push({
      id: 'link-in-opener',
      severity: 'medium',
      title: 'Link placed in the opening line',
      detail: 'Links early in a post can suppress reach on some algorithms. Move it later, or into a comment or bio.',
    });
  }

  if (metrics.allCapsWordRatio > 0.15) {
    suggestions.push({
      id: 'excessive-caps',
      severity: 'low',
      title: 'Excessive ALL-CAPS',
      detail: 'Heavy use of all-caps words can read as shouting and may trigger spam filters.',
    });
  }

  if (!fit.fits) {
    suggestions.push({
      id: 'over-limit',
      severity: 'high',
      title: `Exceeds ${limits.name}'s character limit`,
      detail: `This post is ${fit.overBy} characters over the ${limits.hardLimit}-character limit.`,
    });
  }

  return suggestions.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
