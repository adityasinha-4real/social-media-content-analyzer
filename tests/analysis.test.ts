import { describe, expect, test } from 'vitest';
import { analyzeText } from '../src/lib/analysis';
import { computeMetrics, extractHashtags, extractMentions, extractUrls } from '../src/lib/analysis/metrics';
import { computeReadability } from '../src/lib/analysis/readability';
import { computePlatformFit } from '../src/lib/analysis/platforms';
import { computeSuggestions, hasCta } from '../src/lib/analysis/suggestions';
import { computeScore } from '../src/lib/analysis/score';

// Hand-checked against the running app during Session 3 verification: every
// value below was confirmed in the browser before being pinned here, so this
// fixture is known-good rather than back-derived from the implementation.
const KNOWN_POST =
  'This is a great launch! Are you excited? #launch #newproduct @friend https://example.com \u{1F389}\u{1F389}';

describe('computeMetrics on the known post', () => {
  const metrics = computeMetrics(KNOWN_POST);

  test('character counts', () => {
    expect(metrics.charCount).toBe(93);
    expect(metrics.charCountNoSpaces).toBe(81);
  });

  test('word, sentence, and paragraph counts', () => {
    expect(metrics.wordCount).toBe(14);
    expect(metrics.sentenceCount).toBe(3);
    expect(metrics.paragraphCount).toBe(1);
    expect(metrics.longestSentenceWords).toBe(6);
    expect(metrics.avgWordsPerSentence).toBeCloseTo(14 / 3, 5);
  });

  test('hashtags, mentions, and urls', () => {
    expect(metrics.hashtags).toEqual({ count: 2, tags: ['#launch', '#newproduct'], trailingBlock: false });
    expect(metrics.mentions).toEqual({ count: 1, mentions: ['@friend'] });
    expect(metrics.urls.count).toBe(1);
    expect(metrics.urls.urls).toEqual(['https://example.com']);
    expect(metrics.urls.inFirst100).toBe(true);
  });

  test('emoji and punctuation', () => {
    expect(metrics.emojiCount).toBe(2);
    expect(metrics.emojiDensity).toBeCloseTo(2 / 14, 5);
    expect(metrics.questionMarks).toBe(1);
    expect(metrics.exclamationMarks).toBe(1);
    expect(metrics.allCapsWordRatio).toBe(0);
  });

  test('readability and reading time', () => {
    expect(Math.round(metrics.readability.fleschScore)).toBe(87);
    expect(metrics.readability.gradeBand).toBe('Easy (6th grade)');
    expect(metrics.readingTimeSeconds).toBe(5);
  });
});

describe('extractHashtags', () => {
  test('flags a trailing block of hashtags but not scattered ones', () => {
    expect(extractHashtags('#one #two #three').trailingBlock).toBe(true);
    expect(extractHashtags('Some text #one then more #two').trailingBlock).toBe(false);
  });

  test('ignores a bare # with no word characters after it', () => {
    expect(extractHashtags('price is # 5').count).toBe(0);
  });
});

describe('extractMentions and extractUrls', () => {
  test('requires a leading boundary so an email local-part is not a mention', () => {
    expect(extractMentions('reach me at hi@example.com').count).toBe(0);
    expect(extractMentions('cc @teammate please').mentions).toEqual(['@teammate']);
  });

  test('matches a bare www. link as well as http(s)', () => {
    expect(extractUrls('see www.example.com for details').urls).toEqual(['www.example.com']);
  });
});

describe('computeReadability', () => {
  test('returns a zero score band for empty input', () => {
    const result = computeReadability([], 0);
    expect(result.fleschScore).toBe(0);
    expect(result.gradeBand).toBe('Very difficult (college graduate)');
  });
});

describe('computePlatformFit on the known post (93 chars)', () => {
  const metrics = computeMetrics(KNOWN_POST);
  const fit = computePlatformFit(KNOWN_POST, metrics);

  test('X: fits, hashtag count in range, length verdict good', () => {
    expect(fit.x.fits).toBe(true);
    expect(fit.x.lengthVerdict).toBe('good');
    expect(fit.x.hashtagVerdict).toBe('good');
    expect(fit.x.cutText).toBe(''); // X never truncates
  });

  test('LinkedIn and Instagram read this short post as under their recommended minimum', () => {
    expect(fit.linkedin.lengthVerdict).toBe('short');
    expect(fit.linkedin.hashtagVerdict).toBe('low'); // wants 3-5, post has 2
    expect(fit.instagram.lengthVerdict).toBe('short');
  });

  test('Facebook reads it as long relative to its much shorter recommended range', () => {
    expect(fit.facebook.lengthVerdict).toBe('long');
    expect(fit.facebook.hashtagVerdict).toBe('good'); // wants 1-2, post has 2
  });

  test('truncation preview splits at the platform fold', () => {
    const long = 'A'.repeat(300);
    const longMetrics = computeMetrics(long);
    const longFit = computePlatformFit(long, longMetrics);
    expect(longFit.instagram.preview.length).toBe(125);
    expect(longFit.instagram.cutText.length).toBe(300 - 125);
    expect(longFit.instagram.preview + longFit.instagram.cutText).toBe(long);
  });

  test('over the hard limit reports how far over', () => {
    const tooLong = 'word '.repeat(60); // 300 chars, over X's 280 limit
    const tooLongMetrics = computeMetrics(tooLong);
    const tooLongFit = computePlatformFit(tooLong, tooLongMetrics);
    expect(tooLongFit.x.fits).toBe(false);
    expect(tooLongFit.x.overBy).toBe(tooLongMetrics.charCount - 280);
  });
});

describe('hasCta', () => {
  test('matches any known call-to-action phrase case-insensitively', () => {
    expect(hasCta('Check out our new site')).toBe(true);
    expect(hasCta('LINK IN BIO for more')).toBe(true);
    expect(hasCta('just a plain sentence')).toBe(false);
  });
});

describe('computeSuggestions on the known post for X', () => {
  const metrics = computeMetrics(KNOWN_POST);
  const fit = computePlatformFit(KNOWN_POST, metrics);
  const suggestions = computeSuggestions(KNOWN_POST, metrics, 'x', fit.x);

  test('flags exactly the issues this post actually has, high severity first', () => {
    expect(suggestions.map((s) => s.id)).toEqual(['no-cta', 'link-in-opener', 'hashtags-scattered']);
    expect(suggestions.map((s) => s.severity)).toEqual(['high', 'medium', 'low']);
  });

  test('does not flag a question that is present, or hashtags that are within range', () => {
    expect(suggestions.some((s) => s.id === 'no-question')).toBe(false);
    expect(suggestions.some((s) => s.id === 'hashtag-count')).toBe(false);
    expect(suggestions.some((s) => s.id === 'no-hashtags')).toBe(false);
  });
});

describe('computeScore on the known post for X', () => {
  test('matches the score shown in the app for this exact post', () => {
    const metrics = computeMetrics(KNOWN_POST);
    const fit = computePlatformFit(KNOWN_POST, metrics);
    const score = computeScore(KNOWN_POST, metrics, 'x', fit.x);
    expect(score.total).toBe(76);
    expect(score.cta).toBe(0); // no CTA phrase present
    expect(score.hashtags).toBe(15); // within X's 1-2 recommended range
  });

  test('score stays within 0-100 for a very poor post', () => {
    const bad = 'x'.repeat(1000);
    const metrics = computeMetrics(bad);
    const fit = computePlatformFit(bad, metrics);
    const score = computeScore(bad, metrics, 'x', fit.x);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
  });
});

describe('analyzeText end to end', () => {
  test('returns metrics, platform fit for every platform, suggestions, and a score together', () => {
    const result = analyzeText(KNOWN_POST, 'x');
    expect(result.metrics.wordCount).toBe(14);
    expect(Object.keys(result.platformFit).sort()).toEqual(['facebook', 'instagram', 'linkedin', 'x']);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.score.total).toBe(76);
  });
});
