import { describe, expect, test } from 'vitest';
import { normalizeExtractedText } from '../src/lib/normalize';

describe('normalizeExtractedText', () => {
  test('strips lines that repeat on every page, leaving the unique content', () => {
    const pages = [
      'ACME Quarterly Report\nRevenue grew 12% this quarter.\nPage 1 of 2',
      'ACME Quarterly Report\nSupport tickets dropped sharply.\nPage 2 of 2',
    ];
    const result = normalizeExtractedText(pages);
    expect(result).not.toContain('ACME Quarterly Report');
    expect(result).toContain('Revenue grew 12% this quarter.');
    expect(result).toContain('Support tickets dropped sharply.');
  });

  test('does not strip anything from a single-page document', () => {
    const pages = ['Header\nBody text\nFooter'];
    const result = normalizeExtractedText(pages);
    expect(result).toContain('Header');
    expect(result).toContain('Footer');
  });

  test('a line on most pages but not all of them is left alone, not stripped', () => {
    // Only present on 2 of 3 pages, so it does not qualify as a repeated
    // header/footer under the "every page" rule and must survive.
    const pages = ['Shared line\nOnly on page one', 'Shared line\nOnly on page two', 'Different heading\nOnly on page three'];
    const result = normalizeExtractedText(pages);
    expect(result).toContain('Shared line');
    expect(result).toContain('Different heading');
    expect(result).toContain('Only on page one');
    expect(result).toContain('Only on page three');
  });

  test('rejoins a word split across a line break by a hyphen', () => {
    const result = normalizeExtractedText(['This is an exam-\nple of a hyphen break.']);
    expect(result).toContain('example');
    expect(result).not.toContain('exam-\nple');
  });

  test('does not join a real hyphenated compound at a line end', () => {
    // Only a lowercase-lowercase break is treated as a mid-word split; a
    // capitalized word after the break reads as an intentional line wrap,
    // not a hyphenation, so it's left alone.
    const result = normalizeExtractedText(['State-\nOf-the-art design.']);
    expect(result).toContain('State-\nOf-the-art');
  });

  test('normalises smart quotes, dashes, ellipses, and ligatures', () => {
    const result = normalizeExtractedText(['‘Hello’ — the oﬃce said “wait…”']);
    expect(result).toBe(`'Hello' - the office said "wait..."`);
  });

  test('collapses runs of spaces and caps consecutive blank lines at one', () => {
    const result = normalizeExtractedText(['Too    many     spaces.\n\n\n\n\nNext paragraph.']);
    expect(result).toBe('Too many spaces.\n\nNext paragraph.');
  });

  test('trims leading and trailing whitespace from the final result', () => {
    const result = normalizeExtractedText(['   \n  Padded content.  \n   ']);
    expect(result).toBe('Padded content.');
  });

  test('drops empty pages entirely rather than leaving stray blank paragraphs', () => {
    const result = normalizeExtractedText(['First page text.', '', '   ', 'Third page text.']);
    expect(result).toBe('First page text.\n\nThird page text.');
  });
});
