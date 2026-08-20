export type ProcessingState =
  | 'idle'
  | 'validating'
  | 'extracting'
  | 'ocr'
  | 'analyzing'
  | 'done'
  | 'error';

export type ErrorKind =
  | 'UnsupportedType'
  | 'TooLarge'
  | 'Encrypted'
  | 'Corrupt'
  | 'NoTextFound'
  | 'OcrFailed'
  | 'Cancelled';

export interface ProcessingError {
  kind: ErrorKind;
  message: string;
  action?: string;
}

export interface QueuedFile {
  id: string;
  file: File;
  state: ProcessingState;
  progress: number;
  stageLabel: string;
  extractedText: string | null;
  error: ProcessingError | null;
  /** Non-blocking notice (e.g. the OCR page cap was hit) shown alongside a successful result. */
  warning: string | null;
}

// --- Analysis engine -------------------------------------------------------

export interface HashtagInfo {
  count: number;
  tags: string[];
  /** True when every hashtag sits in a trailing block rather than scattered inline. */
  trailingBlock: boolean;
}

export interface MentionInfo {
  count: number;
  mentions: string[];
}

export interface UrlInfo {
  count: number;
  urls: string[];
  /** True when the first URL falls within the opening 100 characters. */
  inFirst100: boolean;
}

export interface ReadabilityInfo {
  fleschScore: number;
  gradeBand: string;
}

export interface Metrics {
  charCount: number;
  charCountNoSpaces: number;
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  avgWordsPerSentence: number;
  longestSentenceWords: number;
  hashtags: HashtagInfo;
  mentions: MentionInfo;
  urls: UrlInfo;
  emojiCount: number;
  emojiDensity: number;
  questionMarks: number;
  exclamationMarks: number;
  allCapsWordRatio: number;
  readability: ReadabilityInfo;
  readingTimeSeconds: number;
}

export type PlatformId = 'x' | 'linkedin' | 'instagram' | 'facebook';

export interface PlatformLimits {
  id: PlatformId;
  name: string;
  hardLimit: number;
  recommendedMin: number;
  recommendedMax: number;
  hashtagMin: number;
  hashtagMax: number;
  /** Character offset where the platform's feed view folds behind "see more"; null if it never does. */
  truncateAt: number | null;
}

export interface PlatformFitResult {
  platform: PlatformId;
  fits: boolean;
  overBy: number;
  /** Text visible before the platform's fold (or the whole text if it never folds). */
  preview: string;
  /** Text hidden behind "see more"; empty string if nothing is hidden. */
  cutText: string;
  hashtagVerdict: 'none' | 'low' | 'good' | 'high' | 'excessive';
  lengthVerdict: 'short' | 'good' | 'long' | 'over';
}

export type SuggestionSeverity = 'high' | 'medium' | 'low';

export interface Suggestion {
  id: string;
  severity: SuggestionSeverity;
  title: string;
  detail: string;
  evidence?: string;
}

export interface ScoreBreakdown {
  /** 0-100 weighted composite. Heuristic, not a trained model. */
  total: number;
  lengthFit: number;
  cta: number;
  hashtags: number;
  readability: number;
  structure: number;
  hook: number;
}

export interface AnalysisResult {
  metrics: Metrics;
  platformFit: Record<PlatformId, PlatformFitResult>;
  suggestions: Suggestion[];
  score: ScoreBreakdown;
}
