/**
 * Cleans up raw per-page extraction output into text a person would actually
 * want to read and edit: strips headers/footers that repeat on every page,
 * rejoins words split by a line-break hyphen, normalises quotes/ligatures
 * that OCR and pdf.js both produce inconsistently, and tidies whitespace.
 */

function stripRepeatedLines(pages: string[]): string[] {
  if (pages.length < 2) return pages;

  const lineSetPerPage = pages.map(
    (page) => new Set(page.split('\n').map((line) => line.trim()).filter(Boolean)),
  );

  const repeated = new Set<string>();
  for (const line of lineSetPerPage[0]) {
    if (lineSetPerPage.every((set) => set.has(line))) {
      repeated.add(line);
    }
  }

  if (repeated.size === 0) return pages;

  return pages.map((page) =>
    page
      .split('\n')
      .filter((line) => !repeated.has(line.trim()))
      .join('\n'),
  );
}

/** Joins a word broken across a line by a trailing hyphen, e.g. "exam-\nple" -> "example". */
function joinHyphenatedBreaks(text: string): string {
  return text.replace(/([a-z])-\n([a-z])/g, '$1$2');
}

function normalizeQuotesAndLigatures(text: string): string {
  return text
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/ﬀ/g, 'ff')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬃ/g, 'ffi')
    .replace(/ﬄ/g, 'ffl')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');
}

function collapseWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

/** Runs the full normalisation pass over a document's raw per-page text and joins it into one string. */
export function normalizeExtractedText(pages: string[]): string {
  const withoutRepeats = stripRepeatedLines(pages);
  const joined = withoutRepeats.map((page) => page.trim()).filter(Boolean).join('\n\n');
  const withWordsJoined = joinHyphenatedBreaks(joined);
  const withQuotesNormalized = normalizeQuotesAndLigatures(withWordsJoined);
  return collapseWhitespace(withQuotesNormalized).trim();
}
