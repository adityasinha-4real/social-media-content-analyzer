import type { HashtagInfo, MentionInfo, Metrics, UrlInfo } from '../../types';
import { computeReadability } from './readability';

const WORD_RE = /[\p{L}\p{N}'’-]+/gu;
const SENTENCE_SPLIT_RE = /[.!?]+(?:\s+|$)/g;
const HASHTAG_RE = /(^|\s)#([a-zA-Z0-9_]+)/g;
const MENTION_RE = /(^|\s)@([a-zA-Z0-9_.]+)/g;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const EMOJI_RE = /\p{Extended_Pictographic}/gu;

function tokenizeWords(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function extractHashtags(text: string): HashtagInfo {
  const tags: string[] = [];
  const re = new RegExp(HASHTAG_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) tags.push(`#${m[2]}`);

  // A "trailing block" is a final paragraph made up of nothing but hashtags,
  // the pattern platforms reward over hashtags scattered through the copy.
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const last = paragraphs[paragraphs.length - 1] ?? '';
  const trailingBlock = tags.length > 0 && /^(#[a-zA-Z0-9_]+\s*)+$/.test(last);

  return { count: tags.length, tags, trailingBlock };
}

export function extractMentions(text: string): MentionInfo {
  const mentions: string[] = [];
  const re = new RegExp(MENTION_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) mentions.push(`@${m[2]}`);
  return { count: mentions.length, mentions };
}

export function extractUrls(text: string): UrlInfo {
  const urls = text.match(URL_RE) ?? [];
  const first = urls[0];
  const inFirst100 = first ? text.indexOf(first) < 100 : false;
  return { count: urls.length, urls, inFirst100 };
}

export function computeMetrics(text: string): Metrics {
  const trimmed = text.trim();
  const charCount = trimmed.length;
  const charCountNoSpaces = trimmed.replace(/\s/g, '').length;

  const words = tokenizeWords(trimmed);
  const wordCount = words.length;

  const sentences = splitSentences(trimmed);
  const sentenceCount = sentences.length > 0 ? sentences.length : wordCount > 0 ? 1 : 0;
  const sentenceWordCounts = sentences.map((s) => tokenizeWords(s).length);
  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  const longestSentenceWords = sentenceWordCounts.length ? Math.max(...sentenceWordCounts) : 0;

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const paragraphCount = paragraphs.length;

  const hashtags = extractHashtags(trimmed);
  const mentions = extractMentions(trimmed);
  const urls = extractUrls(trimmed);

  const emojiMatches = trimmed.match(EMOJI_RE);
  const emojiCount = emojiMatches ? emojiMatches.length : 0;
  const emojiDensity = wordCount > 0 ? emojiCount / wordCount : 0;

  const questionMarks = (trimmed.match(/\?/g) ?? []).length;
  const exclamationMarks = (trimmed.match(/!/g) ?? []).length;

  const capsWords = words.filter((w) => w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w));
  const allCapsWordRatio = wordCount > 0 ? capsWords.length / wordCount : 0;

  const readability = computeReadability(words, sentenceCount);
  const readingTimeSeconds = Math.ceil((wordCount / 200) * 60);

  return {
    charCount,
    charCountNoSpaces,
    wordCount,
    sentenceCount,
    paragraphCount,
    avgWordsPerSentence,
    longestSentenceWords,
    hashtags,
    mentions,
    urls,
    emojiCount,
    emojiDensity,
    questionMarks,
    exclamationMarks,
    allCapsWordRatio,
    readability,
    readingTimeSeconds,
  };
}
