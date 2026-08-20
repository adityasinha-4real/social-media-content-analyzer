import type { Metrics, PlatformFitResult, PlatformId, PlatformLimits } from '../../types';

export const PLATFORM_ORDER: PlatformId[] = ['x', 'linkedin', 'instagram', 'facebook'];

export const PLATFORM_LIMITS: Record<PlatformId, PlatformLimits> = {
  x: {
    id: 'x',
    name: 'X',
    hardLimit: 280,
    recommendedMin: 71,
    recommendedMax: 100,
    hashtagMin: 1,
    hashtagMax: 2,
    truncateAt: null,
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    hardLimit: 3000,
    recommendedMin: 150,
    recommendedMax: 1300,
    hashtagMin: 3,
    hashtagMax: 5,
    truncateAt: 210,
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    hardLimit: 2200,
    recommendedMin: 138,
    recommendedMax: 150,
    hashtagMin: 5,
    hashtagMax: 15,
    truncateAt: 125,
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    hardLimit: 63206,
    recommendedMin: 40,
    recommendedMax: 80,
    hashtagMin: 1,
    hashtagMax: 2,
    truncateAt: 250,
  },
};

function hashtagVerdict(count: number, min: number, max: number): PlatformFitResult['hashtagVerdict'] {
  if (count === 0) return 'none';
  if (count < min) return 'low';
  if (count <= max) return 'good';
  if (count <= max * 2) return 'high';
  return 'excessive';
}

function lengthVerdict(len: number, limits: PlatformLimits): PlatformFitResult['lengthVerdict'] {
  if (len > limits.hardLimit) return 'over';
  if (len < limits.recommendedMin) return 'short';
  if (len <= limits.recommendedMax) return 'good';
  return 'long';
}

export function computePlatformFit(
  text: string,
  metrics: Metrics,
): Record<PlatformId, PlatformFitResult> {
  const len = metrics.charCount;
  const result = {} as Record<PlatformId, PlatformFitResult>;

  for (const id of PLATFORM_ORDER) {
    const limits = PLATFORM_LIMITS[id];
    const fits = len <= limits.hardLimit;
    const overBy = fits ? 0 : len - limits.hardLimit;

    let preview = text;
    let cutText = '';
    if (limits.truncateAt != null && text.length > limits.truncateAt) {
      preview = text.slice(0, limits.truncateAt);
      cutText = text.slice(limits.truncateAt);
    }

    result[id] = {
      platform: id,
      fits,
      overBy,
      preview,
      cutText,
      hashtagVerdict: hashtagVerdict(metrics.hashtags.count, limits.hashtagMin, limits.hashtagMax),
      lengthVerdict: lengthVerdict(len, limits),
    };
  }

  return result;
}
